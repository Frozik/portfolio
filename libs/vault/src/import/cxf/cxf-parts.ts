import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';

import { fromBase64Url } from '../../crypto/bytes';
import type { TFieldKind, TFieldSpec } from '../../model/card';
import { WIFI_TEMPLATE } from '../../model/templates/wifi';
import type { TOtpAlgorithm } from '../../model/validation/otpauth-uri';
import { formatOtpUri } from '../../model/validation/otpauth-uri';
import type { TImportLabel } from '../imported-card';
import { keyLabel, textLabel } from '../imported-card';
import type { TImportValue } from '../template-card';
import type { TCxfCredential, TCxfField } from './cxf-schema';

/**
 * One value of a CXF credential: the template field it fills when the card
 * has that template (`fillKey`), and the label it takes as a field of its own.
 */
export interface ICxfPart {
  readonly fillKey: string | null;
  readonly label: TImportLabel;
  readonly kind: TFieldKind;
  readonly value: TImportValue;
  readonly spec?: TFieldSpec;
}

const DEFAULT_DIGITS = 6;
const DEFAULT_PERIOD = 30;
const PEM_LINE = 64;
const BASE32_PADDING = /=+$/;

const ALGORITHMS: Readonly<Record<string, TOtpAlgorithm>> = {
  sha1: 'SHA1',
  sha256: 'SHA256',
  sha512: 'SHA512',
};

/** The Wi-Fi template's own select, so the choice keeps its options outside a Wi-Fi card too. */
const WIFI_SECURITY_SPEC = WIFI_TEMPLATE.tabs
  .flatMap(tab => tab.fields)
  .find(field => field.labelKey === 'field.security')?.spec;

/** CXF's `wifi-network-security-type` → the Wi-Fi template's options. */
const WIFI_SECURITY: Readonly<Record<string, string>> = {
  unsecured: 'option.open',
  wep: 'option.wep',
  'wpa-personal': 'option.wpa',
  'wpa2-personal': 'option.wpa2',
  'wpa3-personal': 'option.wpa3',
};

const KIND_OF_TYPE: Readonly<Record<string, TFieldKind>> = {
  'concealed-string': 'secret',
  email: 'email',
  boolean: 'boolean',
  date: 'date',
};

/** A field CXF types by its own vocabulary, as the nearest kind of ours. */
function kindOf(field: TCxfField): TFieldKind {
  const kind = KIND_OF_TYPE[field.fieldType];
  if (!isNil(kind)) {
    return kind;
  }
  return field.value.includes('\n') ? 'multiline' : 'text';
}

function part(
  field: TCxfField | undefined,
  kind: TFieldKind,
  fillKey: string | null,
  labelKey: string
): readonly ICxfPart[] {
  return isNil(field) || field.value === ''
    ? []
    : [{ fillKey, label: keyLabel(labelKey), kind, value: field.value }];
}

function typedPart(field: TCxfField | undefined, labelKey: string): readonly ICxfPart[] {
  return isNil(field) ? [] : part(field, kindOf(field), null, labelKey);
}

/** PKCS#8 DER, as CXF carries a private key, written the way SSH tools read it. */
function privateKeyPem(derBase64Url: string): string | null {
  const der = fromBase64Url(derBase64Url);
  if (isNil(der)) {
    return null;
  }
  let binary = '';
  for (const byte of der) {
    binary += String.fromCharCode(byte);
  }
  const lines = btoa(binary).match(new RegExp(`.{1,${PEM_LINE}}`, 'g')) ?? [];
  return ['-----BEGIN PRIVATE KEY-----', ...lines, '-----END PRIVATE KEY-----'].join('\n');
}

function totpParts(
  credential: Extract<TCxfCredential, { type: 'totp' }>,
  title: string
): readonly ICxfPart[] | null {
  const algorithm = ALGORITHMS[(credential.algorithm ?? 'sha1').toLowerCase()];
  if (isNil(algorithm)) {
    return null;
  }
  const uri = formatOtpUri({
    type: 'totp',
    label: credential.username ?? title,
    issuer: credential.issuer ?? null,
    secret: credential.secret.toUpperCase().replace(BASE32_PADDING, ''),
    algorithm,
    digits: credential.digits ?? DEFAULT_DIGITS,
    period: credential.period ?? DEFAULT_PERIOD,
    counter: 0,
    encoder: 'default',
  });
  return [{ fillKey: null, label: keyLabel('field.oneTimeCode'), kind: 'otp', value: uri }];
}

function wifiSecurity(field: TCxfField | undefined): readonly ICxfPart[] {
  const option = isNil(field) ? undefined : WIFI_SECURITY[field.value];
  if (isNil(field) || isNil(option)) {
    return typedPart(field, 'field.security');
  }
  return [
    {
      fillKey: 'field.security',
      label: keyLabel('field.security'),
      kind: 'select',
      value: option,
      spec: WIFI_SECURITY_SPEC,
    },
  ];
}

function documentParts(
  credential: Extract<TCxfCredential, { type: 'passport' | 'identity-document' }>
): readonly ICxfPart[] {
  return [
    ...part(
      credential.passportNumber ?? credential.documentNumber,
      'secret',
      'field.documentNumber',
      'field.documentNumber'
    ),
    ...part(credential.issuingAuthority, 'text', 'field.issuedBy', 'field.issuedBy'),
    ...part(credential.issueDate, 'date', 'field.issuedOn', 'field.issuedOn'),
    ...part(credential.expiryDate, 'expiry-date', 'field.expiresOn', 'field.expiresOn'),
    ...part(credential.fullName, 'text', null, 'field.fullName'),
    ...part(
      credential.nationalIdentificationNumber ?? credential.identificationNumber,
      'secret',
      null,
      'field.nationalId'
    ),
    ...part(credential.birthDate, 'date', null, 'field.birthDate'),
    ...part(credential.birthPlace, 'text', null, 'field.birthPlace'),
    ...part(credential.nationality, 'text', null, 'field.nationality'),
    ...part(credential.issuingCountry, 'text', null, 'field.issuingCountry'),
    ...part(credential.sex, 'text', null, 'field.sex'),
    ...part(credential.passportType, 'text', null, 'field.documentType'),
  ];
}

/**
 * The values of one credential as fields; `null` for one
 * whose values cannot be read (an unknown one-time code algorithm, a broken
 * key). Files, links and passkeys are the mapper's: they are not fields.
 */
export function partsOf(credential: TCxfCredential, title: string): readonly ICxfPart[] | null {
  switch (credential.type) {
    case 'basic-auth':
      return [
        ...part(credential.username, 'login', 'field.login', 'field.login'),
        ...part(credential.password, 'password', 'field.password', 'field.password'),
      ];
    case 'totp':
      return totpParts(credential, title);
    case 'note':
      return part(credential.content, 'multiline', 'field.notes', 'field.notes');
    case 'credit-card':
      return [
        ...part(credential.number, 'card-number', 'field.cardNumber', 'field.cardNumber'),
        ...part(credential.fullName, 'text', 'field.cardholder', 'field.cardholder'),
        ...part(credential.expiryDate, 'expiry-month', 'field.validThru', 'field.validThru'),
        ...part(credential.verificationNumber, 'cvv', 'field.securityCode', 'field.securityCode'),
        ...part(credential.pin, 'pin', 'field.pin', 'field.pin'),
        ...part(credential.cardType, 'text', null, 'field.cardType'),
        ...typedPart(credential.validFrom, 'field.validFrom'),
      ];
    case 'wifi':
      return [
        ...part(credential.ssid, 'text', 'field.ssid', 'field.ssid'),
        ...part(credential.passphrase, 'password', 'field.password', 'field.password'),
        ...wifiSecurity(credential.networkSecurityType),
        ...part(credential.hidden, 'boolean', 'field.hiddenNetwork', 'field.hiddenNetwork'),
      ];
    case 'ssh-key': {
      const pem = privateKeyPem(credential.privateKey);
      return isNil(pem)
        ? null
        : [
            {
              fillKey: 'field.privateKey',
              label: keyLabel('field.privateKey'),
              kind: 'multiline',
              value: pem,
            },
            ...(isNil(credential.keyComment) || credential.keyComment === ''
              ? []
              : [
                  {
                    fillKey: null,
                    label: keyLabel('field.keyComment'),
                    kind: 'text' as const,
                    value: credential.keyComment,
                  },
                ]),
          ];
    }
    case 'passport':
    case 'identity-document':
      return documentParts(credential);
    case 'api-key':
      return [
        ...part(credential.key, 'secret', null, 'field.apiKey'),
        ...part(credential.username, 'login', 'field.login', 'field.login'),
        ...part(credential.url, 'url', null, 'field.websites'),
        ...part(credential.keyType, 'text', null, 'field.keyType'),
        ...typedPart(credential.validFrom, 'field.validFrom'),
        ...part(credential.expiryDate, 'expiry-date', null, 'field.expiresOn'),
      ];
    case 'custom-fields':
      return credential.fields
        .filter(field => field.value !== '')
        .map(field => ({
          fillKey: null,
          label: textLabel(field.label ?? credential.label ?? ''),
          kind: kindOf(field),
          value: field.value,
        }));
    case 'item-reference':
    case 'file':
    case 'passkey':
      return [];
    default:
      return assertNever(credential);
  }
}
