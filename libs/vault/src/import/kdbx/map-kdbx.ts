import type { Kdbx, KdbxEntry, KdbxEntryField, KdbxGroup } from 'kdbxweb';
import { ProtectedValue } from 'kdbxweb';
import { isNil, uniq } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

import { toHex } from '../../crypto/bytes';
import type { TAssetId } from '../../model/ids';
import { INTERNET_ACCOUNT_TEMPLATE } from '../../model/templates/internet-account';
import { NOTE_TEMPLATE } from '../../model/templates/note';
import type { TOtpAlgorithm } from '../../model/validation/otpauth-uri';
import { formatOtpUri } from '../../model/validation/otpauth-uri';
import type { IImportBatch, IImportedAsset, IImportedCard, IImportedField } from '../imported-card';
import { keyLabel, textLabel } from '../imported-card';
import { extraField, fill, plainCard, templateTabs } from '../template-card';

const STANDARD_FIELDS = new Set(['Title', 'UserName', 'Password', 'URL', 'Notes']);
/** KeePassXC keeps a one-time code as an `otpauth://` URI in this field. */
const OTP_FIELD = 'otp';
/** KeePass 2.47+ keeps one in these. */
const TIME_OTP_PREFIX = 'TimeOtp-';
const TIME_OTP = {
  secret: 'TimeOtp-Secret-Base32',
  length: 'TimeOtp-Length',
  period: 'TimeOtp-Period',
  algorithm: 'TimeOtp-Algorithm',
} as const;
const TIME_OTP_ALGORITHMS: Readonly<Record<string, TOtpAlgorithm>> = {
  'HMAC-SHA-1': 'SHA1',
  'HMAC-SHA-256': 'SHA256',
  'HMAC-SHA-512': 'SHA512',
};
const DEFAULT_DIGITS = 6;
const DEFAULT_PERIOD = 30;
const FALLBACK_MIME = 'application/octet-stream';

function text(field: KdbxEntryField | undefined): string {
  if (isNil(field)) {
    return '';
  }
  return field instanceof ProtectedValue ? field.getText() : field;
}

function customField(name: string, field: KdbxEntryField): IImportedField | null {
  const value = text(field);
  if (value === '') {
    return null;
  }
  if (name === OTP_FIELD && value.startsWith('otpauth://')) {
    return extraField('otp', keyLabel('field.oneTimeCode'), value);
  }
  const kind =
    field instanceof ProtectedValue ? 'secret' : value.includes('\n') ? 'multiline' : 'text';
  return extraField(kind, textLabel(name), value);
}

function timeOtp(entry: KdbxEntry, title: string): IImportedField | null {
  const secret = text(entry.fields.get(TIME_OTP.secret)).replace(/\s|=/g, '').toUpperCase();
  const algorithm = TIME_OTP_ALGORITHMS[text(entry.fields.get(TIME_OTP.algorithm)) || 'HMAC-SHA-1'];
  if (secret === '' || isNil(algorithm)) {
    return null;
  }
  const uri = formatOtpUri({
    type: 'totp',
    label: text(entry.fields.get('UserName')) || title,
    issuer: title === '' ? null : title,
    secret,
    algorithm,
    digits: Number(text(entry.fields.get(TIME_OTP.length))) || DEFAULT_DIGITS,
    period: Number(text(entry.fields.get(TIME_OTP.period))) || DEFAULT_PERIOD,
    counter: 0,
    encoder: 'default',
  });
  return extraField('otp', keyLabel('field.oneTimeCode'), uri);
}

function expiryOf(entry: KdbxEntry): string | null {
  const { expires, expiryTime } = entry.times;
  return expires === true && !isNil(expiryTime)
    ? Temporal.Instant.fromEpochMilliseconds(expiryTime.getTime())
        .toZonedDateTimeISO('UTC')
        .toPlainDate()
        .toString()
    : null;
}

async function sha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
}

async function attachments(entry: KdbxEntry, assets: IImportedAsset[]): Promise<readonly string[]> {
  const ids: string[] = [];
  for (const [name, binary] of entry.binaries) {
    const value = 'hash' in binary ? binary.value : binary;
    const bytes =
      value instanceof ProtectedValue
        ? Uint8Array.from(value.getBinary())
        : new Uint8Array(value.slice(0));
    const id = `${entry.uuid.id}/${name}`;
    assets.push({
      asset: { id: id as TAssetId, name, mime: FALLBACK_MIME, sha256: await sha256Hex(bytes) },
      bytes,
    });
    ids.push(id);
  }
  return ids;
}

async function cardOf(
  entry: KdbxEntry,
  groups: readonly string[],
  assets: IImportedAsset[]
): Promise<IImportedCard> {
  const title = text(entry.fields.get('Title'));
  const login = text(entry.fields.get('UserName'));
  const password = text(entry.fields.get('Password'));
  const url = text(entry.fields.get('URL'));
  const expiry = expiryOf(entry);
  const files = await attachments(entry, assets);
  const totp = timeOtp(entry, title);
  const extras = [
    ...[...entry.fields]
      .filter(([name]) => !STANDARD_FIELDS.has(name) && !name.startsWith(TIME_OTP_PREFIX))
      .flatMap(([name, field]) => customField(name, field) ?? []),
    ...(isNil(totp) ? [] : [totp]),
    ...(isNil(expiry) ? [] : [extraField('expiry-date', keyLabel('field.expiresOn'), expiry)]),
    ...(files.length === 0 ? [] : [extraField('file', keyLabel('field.files'), files)]),
  ];
  const account = login !== '' || password !== '' || url !== '';
  const template = account ? INTERNET_ACCOUNT_TEMPLATE : NOTE_TEMPLATE;
  const fills = {
    'field.notes': fill(text(entry.fields.get('Notes'))),
    ...(account
      ? {
          'field.websites': fill(url === '' ? [] : [url]),
          'field.login': fill(login),
          'field.password': fill(password),
        }
      : {}),
  };
  return plainCard(template, title, templateTabs(template, fills, extras), {
    groups: uniq([...groups, ...entry.tags]),
    createdAtMs: entry.times.creationTime?.getTime() ?? null,
  });
}

/**
 * KeePass: every entry outside the recycle bin, its group
 * (the root's own name aside) as a group, tags too; the five standard fields
 * fill an internet account (or a note, with none of login, password and
 * address), the others become fields — protected ones secret —, one-time
 * codes of KeePassXC and of KeePass 2.47 become `otpauth://`, attachments files.
 */
export async function importKdbx(database: Kdbx): Promise<IImportBatch> {
  const recycleBin = database.meta.recycleBinUuid?.id;
  const assets: IImportedAsset[] = [];
  const cards: IImportedCard[] = [];
  const walk = async (group: KdbxGroup, names: readonly string[]): Promise<void> => {
    if (!isNil(recycleBin) && group.uuid.id === recycleBin) {
      return;
    }
    for (const entry of group.entries) {
      cards.push(await cardOf(entry, names, assets));
    }
    for (const child of group.groups) {
      await walk(child, isNil(child.name) || child.name === '' ? names : [child.name]);
    }
  };
  await walk(database.getDefaultGroup(), []);
  return { source: 'keepass', cards, links: [], assets, warnings: [] };
}
