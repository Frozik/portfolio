import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';
import { isNil } from 'lodash-es';

import type { IOtpParams, TOtpAlgorithm } from '../model/validation/otpauth-uri';
import { encodeBase32 } from './base32';

const SCHEME = 'otpauth-migration:';
const WIRE_VARINT = 0;
const WIRE_64 = 1;
const WIRE_LENGTH = 2;
const WIRE_32 = 5;
const SEVEN_BITS = 0x7f;
const CONTINUES = 0x80;
const VARINT_SHIFT = 7;
const BYTES_64 = 8;
const BYTES_32 = 4;
const DEFAULT_PERIOD = 30;

/** The fields of Google Authenticator's `MigrationPayload` and its `OtpParameters` this reads. */
const PAYLOAD_OTP = 1;
const OTP = {
  secret: 1,
  name: 2,
  issuer: 3,
  algorithm: 4,
  digits: 5,
  type: 6,
  counter: 7,
} as const;
const ALGORITHMS: Readonly<Record<number, TOtpAlgorithm>> = {
  0: 'SHA1',
  1: 'SHA1',
  2: 'SHA256',
  3: 'SHA512',
};
const DIGITS: Readonly<Record<number, number>> = { 0: 6, 1: 6, 2: 8 };
const HOTP = 1;

type TField = { readonly number: number } & (
  | { readonly kind: 'varint'; readonly value: number }
  | { readonly kind: 'bytes'; readonly value: Uint8Array }
);

/** Protocol Buffers' wire format, as far as two small messages need it; `null` for anything malformed. */
function fieldsOf(bytes: Uint8Array): readonly TField[] | null {
  const fields: TField[] = [];
  let offset = 0;
  const varint = (): number | null => {
    let value = 0;
    let multiplier = 1;
    while (offset < bytes.length) {
      const byte = bytes[offset] ?? 0;
      offset += 1;
      value += (byte & SEVEN_BITS) * multiplier;
      if ((byte & CONTINUES) === 0) {
        return value;
      }
      multiplier *= 2 ** VARINT_SHIFT;
    }
    return null;
  };
  while (offset < bytes.length) {
    const key = varint();
    if (isNil(key)) {
      return null;
    }
    const number = Math.floor(key / 2 ** 3);
    const wire = key % 2 ** 3;
    if (wire === WIRE_VARINT) {
      const value = varint();
      if (isNil(value)) {
        return null;
      }
      fields.push({ number, kind: 'varint', value });
    } else if (wire === WIRE_LENGTH) {
      const length = varint();
      if (isNil(length) || offset + length > bytes.length) {
        return null;
      }
      fields.push({ number, kind: 'bytes', value: bytes.subarray(offset, offset + length) });
      offset += length;
    } else if (wire === WIRE_64 || wire === WIRE_32) {
      offset += wire === WIRE_64 ? BYTES_64 : BYTES_32;
    } else {
      return null;
    }
  }
  return offset === bytes.length ? fields : null;
}

function base64Bytes(text: string): Uint8Array | null {
  try {
    return Uint8Array.from(atob(text), char => char.charCodeAt(0));
  } catch {
    return null;
  }
}

function paramsOf(message: Uint8Array): IOtpParams | null {
  const fields = fieldsOf(message);
  if (isNil(fields)) {
    return null;
  }
  const bytesOf = (number: number): Uint8Array | undefined =>
    fields.find(
      (field): field is Extract<TField, { kind: 'bytes' }> =>
        field.number === number && field.kind === 'bytes'
    )?.value;
  const numberOf = (number: number): number => {
    const field = fields.find(candidate => candidate.number === number);
    return field?.kind === 'varint' ? field.value : 0;
  };
  const secret = bytesOf(OTP.secret);
  const algorithm = ALGORITHMS[numberOf(OTP.algorithm)];
  const digits = DIGITS[numberOf(OTP.digits)];
  if (isNil(secret) || secret.length === 0 || isNil(algorithm) || isNil(digits)) {
    return null;
  }
  const text = (number: number): string => new TextDecoder().decode(bytesOf(number));
  const issuer = text(OTP.issuer);
  return {
    type: numberOf(OTP.type) === HOTP ? 'hotp' : 'totp',
    label: text(OTP.name),
    issuer: issuer === '' ? null : issuer,
    secret: encodeBase32(secret),
    algorithm,
    digits,
    period: DEFAULT_PERIOD,
    counter: numberOf(OTP.counter),
    encoder: 'default',
  };
}

/**
 * Google Authenticator's "Transfer accounts" QR:
 * `otpauth-migration://offline?data=<base64 protobuf>`, one or more codes.
 * An entry this cannot use (MD5, an empty secret) is left out.
 */
export function parseOtpMigration(text: string): TResult<readonly IOtpParams[], 'not-migration'> {
  if (!text.trim().toLowerCase().startsWith(SCHEME)) {
    return err('not-migration');
  }
  const data = (() => {
    try {
      return new URL(text.trim()).searchParams.get('data');
    } catch {
      return null;
    }
  })();
  const payload = isNil(data) ? null : base64Bytes(data);
  const fields = isNil(payload) ? null : fieldsOf(payload);
  if (isNil(fields)) {
    return err('not-migration');
  }
  const entries = fields.flatMap(field => {
    const params =
      field.number === PAYLOAD_OTP && field.kind === 'bytes' ? paramsOf(field.value) : null;
    return isNil(params) ? [] : [params];
  });
  return entries.length === 0 ? err('not-migration') : ok(entries);
}
