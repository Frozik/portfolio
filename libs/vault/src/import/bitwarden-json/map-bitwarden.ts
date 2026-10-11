import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

import type { TFieldKind, TFieldSpec, TUrlMatch } from '../../model/card';
import { BANK_CARD_TEMPLATE } from '../../model/templates/bank-card';
import { DOCUMENT_TEMPLATE } from '../../model/templates/document';
import { INTERNET_ACCOUNT_TEMPLATE } from '../../model/templates/internet-account';
import { NOTE_TEMPLATE } from '../../model/templates/note';
import { SERVER_TEMPLATE } from '../../model/templates/server';
import type { ICardTemplate } from '../../model/templates/template';
import type { IImportBatch, IImportedCard, IImportedField, TImportWarning } from '../imported-card';
import { keyLabel, textLabel } from '../imported-card';
import type { IFill } from '../template-card';
import { extraField, fill, plainCard, templateTabs } from '../template-card';
import type { TBitwardenExport, TBitwardenItem } from './bitwarden-schema';

const LOGIN = 1;
const SECURE_NOTE = 2;
const CARD = 3;
const IDENTITY = 4;
const SSH_KEY = 5;

const TEXT_FIELD = 0;
const HIDDEN_FIELD = 1;
const BOOLEAN_FIELD = 2;

const REPROMPT_PASSWORD = 1;

/** Bitwarden's URI match detection by number; with none it matches the base domain. */
const URL_MATCHES: readonly TUrlMatch[] = [
  'base-domain',
  'host',
  'starts-with',
  'exact',
  'regex',
  'never',
];
const DEFAULT_URL_MATCH: TUrlMatch = 'base-domain';

type TItemOf<Key extends keyof TBitwardenItem> = NonNullable<TBitwardenItem[Key]>;

function urlSpec(match: TUrlMatch): TFieldSpec {
  return { kind: 'url', match, useSharedCredentials: true };
}

/** One URL list per matching rule, since a field holds one rule. */
function urlsByMatch(login: TItemOf<'login'>): readonly (readonly [TUrlMatch, string[]])[] {
  const groups = new Map<TUrlMatch, string[]>();
  for (const { uri, match } of login.uris ?? []) {
    if (isNil(uri) || uri === '') {
      continue;
    }
    const rule = isNil(match) ? DEFAULT_URL_MATCH : (URL_MATCHES[match] ?? DEFAULT_URL_MATCH);
    groups.set(rule, [...(groups.get(rule) ?? []), uri]);
  }
  return [...groups];
}

function customFields(item: TBitwardenItem, warnings: TImportWarning[]): IImportedField[] {
  const title = item.name ?? '';
  return (item.fields ?? []).flatMap(field => {
    const label = textLabel(field.name ?? '');
    const value = field.value ?? '';
    switch (field.type) {
      case TEXT_FIELD:
        return [extraField('text', label, value)];
      case HIDDEN_FIELD:
        return [extraField('secret', label, value)];
      case BOOLEAN_FIELD:
        return [extraField('boolean', label, value === 'true' ? 'true' : 'false')];
      default:
        warnings.push({ kind: 'field-dropped', card: title, label: field.name ?? '' });
        return [];
    }
  });
}

interface IItemContent {
  readonly template: ICardTemplate;
  readonly fills: Readonly<Record<string, IFill>>;
  readonly extras: readonly IImportedField[];
}

function joined(parts: readonly (string | null | undefined)[], separator: string): string {
  return parts.filter(part => !isNil(part) && part !== '').join(separator);
}

function loginContent(login: TItemOf<'login'>): Omit<IItemContent, 'template'> {
  const [first, ...others] = urlsByMatch(login);
  return {
    fills: {
      'field.websites': fill(first?.[1] ?? [], urlSpec(first?.[0] ?? DEFAULT_URL_MATCH)),
      'field.login': fill(login.username ?? ''),
      'field.password': fill(login.password ?? ''),
    },
    extras: [
      ...others.map(([match, urls]) =>
        extraField('url', keyLabel('field.websites'), urls, urlSpec(match))
      ),
      ...(isNil(login.totp) || login.totp === ''
        ? []
        : [extraField('otp', keyLabel('field.oneTimeCode'), login.totp)]),
    ],
  };
}

function identityContent(identity: TItemOf<'identity'>): Omit<IItemContent, 'template'> {
  const name = joined(
    [identity.title, identity.firstName, identity.middleName, identity.lastName],
    ' '
  );
  const address = joined(
    [
      identity.address1,
      identity.address2,
      identity.address3,
      joined([identity.postalCode, identity.city, identity.state], ' '),
      identity.country,
    ],
    '\n'
  );
  const extras: readonly (readonly [TFieldKind, string, string | null | undefined])[] = [
    ['text', 'field.fullName', name],
    ['text', 'field.company', identity.company],
    ['email', 'field.email', identity.email],
    ['phone', 'field.phone', identity.phone],
    ['multiline', 'field.address', address],
    ['login', 'field.login', identity.username],
    ['secret', 'field.nationalId', identity.ssn],
    ['secret', 'field.licenseNumber', identity.licenseNumber],
  ];
  return {
    fills: { 'field.documentNumber': fill(identity.passportNumber ?? '') },
    extras: extras
      .filter(([, , value]) => !isNil(value) && value !== '')
      .map(([kind, key, value]) => extraField(kind, keyLabel(key), value ?? '')),
  };
}

function contentOf(item: TBitwardenItem): IItemContent | null {
  const { login, card, identity, sshKey } = item;
  if (item.type === LOGIN && !isNil(login)) {
    return { template: INTERNET_ACCOUNT_TEMPLATE, ...loginContent(login) };
  }
  if (item.type === CARD && !isNil(card)) {
    const expiry = joined([card.expMonth, card.expYear], '/');
    return {
      template: BANK_CARD_TEMPLATE,
      fills: {
        'field.cardNumber': fill(card.number ?? ''),
        'field.cardholder': fill(card.cardholderName ?? ''),
        'field.validThru': fill(expiry.includes('/') ? expiry : ''),
        'field.securityCode': fill(card.code ?? ''),
      },
      extras: [],
    };
  }
  if (item.type === IDENTITY && !isNil(identity)) {
    return { template: DOCUMENT_TEMPLATE, ...identityContent(identity) };
  }
  if (item.type === SSH_KEY && !isNil(sshKey)) {
    return {
      template: SERVER_TEMPLATE,
      fills: { 'field.privateKey': fill(sshKey.privateKey ?? '') },
      extras: [
        extraField('multiline', keyLabel('field.publicKey'), sshKey.publicKey ?? ''),
        extraField('text', keyLabel('field.fingerprint'), sshKey.keyFingerprint ?? ''),
      ],
    };
  }
  return item.type === SECURE_NOTE ? { template: NOTE_TEMPLATE, fills: {}, extras: [] } : null;
}

/**
 * Logins, notes, cards, identities and SSH keys; folders and
 * collections become groups, `reprompt` a protected card, the archive the
 * archive. Linked fields and passkeys have no place here and are reported.
 */
export function importBitwardenJson(data: TBitwardenExport): IImportBatch {
  const groupNames = new Map(
    [...(data.folders ?? []), ...(data.collections ?? [])].map(({ id, name }) => [id, name])
  );
  const warnings: TImportWarning[] = [];
  const cards: IImportedCard[] = [];
  for (const item of data.items) {
    const title = item.name ?? '';
    const content = contentOf(item);
    if (isNil(content) || !isNil(item.deletedDate)) {
      warnings.push({ kind: 'item-skipped', title });
      continue;
    }
    if ((item.login?.fido2Credentials ?? []).length > 0) {
      warnings.push({ kind: 'passkey-dropped', card: title });
    }
    const groups = [item.folderId, ...(item.collectionIds ?? [])].flatMap(id => {
      const name = isNil(id) ? undefined : groupNames.get(id);
      return isNil(name) ? [] : [name];
    });
    cards.push(
      plainCard(
        content.template,
        title,
        templateTabs(
          content.template,
          { ...content.fills, 'field.notes': fill(item.notes ?? '') },
          [...content.extras, ...customFields(item, warnings)]
        ),
        {
          groups,
          favorite: item.favorite === true,
          protected: item.reprompt === REPROMPT_PASSWORD,
          archived: !isNil(item.archivedDate),
          createdAtMs: isNil(item.creationDate)
            ? null
            : Temporal.Instant.from(item.creationDate).epochMilliseconds,
        }
      )
    );
  }
  return { source: 'bitwarden', cards, links: [], assets: [], warnings };
}
