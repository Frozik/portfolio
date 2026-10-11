import { isNil } from 'lodash-es';

import { fileAssetIdsOf } from '../../model/asset-edits';
import type { ICardField, IVaultCard, TFieldKind } from '../../model/card';
import { allFields, fieldValues, isPasswordRotation, valuesInUse } from '../../model/card';
import type { TAssetId } from '../../model/ids';
import { parseOtpUri } from '../../model/validation/otpauth-uri';

/** CXF 1.0 `EditableField`: what every exported value is wrapped in. */
export interface ICxfField {
  readonly fieldType: string;
  readonly value: string;
  readonly label?: string;
}

export type TCxfOutCredential = { readonly type: string } & Readonly<Record<string, unknown>>;

const CONCEALED: ReadonlySet<string> = new Set(['password', 'secret', 'pin', 'cvv', 'card-number']);
const FIELD_TYPE_OF: Readonly<Partial<Record<string, string>>> = {
  email: 'email',
  boolean: 'boolean',
  date: 'date',
  'expiry-date': 'date',
  'expiry-month': 'year-month',
};

/** The Wi-Fi template's options by position, as CXF's `wifi-network-security-type`. */
const WIFI_SECURITY = ['wpa3-personal', 'wpa2-personal', 'wpa-personal', 'wep', 'unsecured'];

function fieldTypeOf(field: ICardField): string {
  if (field.sensitive || CONCEALED.has(field.spec.kind)) {
    return 'concealed-string';
  }
  return FIELD_TYPE_OF[field.spec.kind] ?? 'string';
}

function editable(field: ICardField, value: string): ICxfField {
  return { fieldType: fieldTypeOf(field), value, label: field.label };
}

/**
 * The card's fields, each taken once: a credential takes the first unused
 * field of a kind, and whatever no credential takes ends in `custom-fields`.
 */
class FieldPool {
  private readonly used = new Set<string>();

  constructor(private readonly fields: readonly ICardField[]) {}

  take(kind: TFieldKind): ICxfField | undefined {
    const field = this.takeField(kind);
    const [value] = isNil(field) ? [] : valuesInUse(field);
    return isNil(field) || isNil(value) ? undefined : editable(field, value);
  }

  takeField(kind: TFieldKind): ICardField | undefined {
    const field = this.fields.find(
      candidate =>
        candidate.spec.kind === kind &&
        !this.used.has(candidate.id) &&
        (candidate.value.cardinality === 'single' || isPasswordRotation(candidate)) &&
        valuesInUse(candidate).length > 0
    );
    if (!isNil(field)) {
      this.used.add(field.id);
    }
    return field;
  }

  takeAll(kind: TFieldKind): readonly ICardField[] {
    const fields = this.fields.filter(
      field => field.spec.kind === kind && !this.used.has(field.id)
    );
    fields.forEach(field => this.used.add(field.id));
    return fields;
  }

  rest(): readonly ICxfField[] {
    return this.fields
      .filter(field => !this.used.has(field.id) && field.spec.kind !== 'unknown')
      .flatMap(field => fieldValues(field).map(value => editable(field, value)));
  }
}

function present<T extends Readonly<Record<string, unknown>>>(credential: T): T | null {
  return Object.entries(credential).some(([key, value]) => key !== 'type' && !isNil(value))
    ? credential
    : null;
}

/** A Wi-Fi card's select keeps the template's options in their order, translated: the position names the type. */
function wifiSecurity(pool: FieldPool): ICxfField | undefined {
  const field = pool.takeField('select');
  if (isNil(field) || field.spec.kind !== 'select' || field.value.cardinality !== 'single') {
    return undefined;
  }
  const security = WIFI_SECURITY[field.spec.options.indexOf(field.value.value)];
  return isNil(security)
    ? editable(field, field.value.value)
    : { fieldType: 'wifi-network-security-type', value: security, label: field.label };
}

function templateCredential(card: IVaultCard, pool: FieldPool): TCxfOutCredential | null {
  switch (card.templateId) {
    case 'bank-card':
      return present({
        type: 'credit-card',
        number: pool.take('card-number'),
        fullName: pool.take('text'),
        expiryDate: pool.take('expiry-month'),
        verificationNumber: pool.take('cvv'),
        pin: pool.take('pin'),
      });
    case 'wifi':
      return present({
        type: 'wifi',
        ssid: pool.take('text'),
        passphrase: pool.take('password'),
        networkSecurityType: wifiSecurity(pool),
        hidden: pool.take('boolean'),
      });
    case 'document':
      return present({
        type: 'identity-document',
        documentNumber: pool.take('secret'),
        issuingAuthority: pool.take('text'),
        issueDate: pool.take('date'),
        expiryDate: pool.take('expiry-date'),
      });
    default:
      return null;
  }
}

function totpOf(field: ICardField): TCxfOutCredential | ICxfField | null {
  if (field.value.cardinality !== 'single' || field.value.value === '') {
    return null;
  }
  const parsed = parseOtpUri(field.value.value);
  if (!parsed.ok || parsed.value.type !== 'totp' || parsed.value.encoder !== 'default') {
    return editable(field, field.value.value);
  }
  const { secret, period, digits, algorithm, label, issuer } = parsed.value;
  return {
    type: 'totp',
    secret,
    period,
    digits,
    algorithm: algorithm.toLowerCase(),
    username: label,
    ...(isNil(issuer) ? {} : { issuer }),
  };
}

export interface ICardCredentials {
  readonly urls: readonly string[];
  readonly credentials: readonly TCxfOutCredential[];
  /** The card's files, for the archive to carry under their CXF ids. */
  readonly fileIds: readonly TAssetId[];
}

/**
 * A card as CXF credentials: the one its template is
 * (card, Wi-Fi, document), a login and password as `basic-auth`, one-time
 * codes as `totp`, the first note as `note`, files as `file` (described by
 * the caller, who has their bytes), everything else as `custom-fields`.
 */
export function credentialsOfCard(card: IVaultCard): ICardCredentials {
  const pool = new FieldPool(allFields(card));
  const main = templateCredential(card, pool);
  const basicAuth = present({
    type: 'basic-auth',
    username: pool.take('login'),
    password: pool.take('password'),
  });
  const otps = pool.takeAll('otp').flatMap(field => {
    const totp = totpOf(field);
    return isNil(totp) ? [] : [totp];
  });
  const note = pool.take('note');
  const urls = pool.takeAll('url').flatMap(fieldValues);
  const fileIds = pool.takeAll('file').flatMap(fileAssetIdsOf);
  const custom = [
    ...otps.filter((entry): entry is ICxfField => !('type' in entry)),
    ...pool.rest(),
  ];
  return {
    urls,
    fileIds,
    credentials: [
      ...(isNil(main) ? [] : [main]),
      ...(isNil(basicAuth) ? [] : [basicAuth]),
      ...otps.filter((entry): entry is TCxfOutCredential => 'type' in entry),
      ...(isNil(note) ? [] : [{ type: 'note', content: note }]),
      ...(custom.length === 0 ? [] : [{ type: 'custom-fields', fields: custom }]),
    ],
  };
}
