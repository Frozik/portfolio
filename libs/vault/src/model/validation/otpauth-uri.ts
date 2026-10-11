import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';
import { isNil } from 'lodash-es';

import { parseUrl } from '../parse-url';

export type TOtpAlgorithm = 'SHA1' | 'SHA256' | 'SHA512';

export interface IOtpParams {
  readonly type: 'totp' | 'hotp';
  readonly label: string;
  readonly issuer: string | null;
  /** Base32, upper case, no padding. */
  readonly secret: string;
  readonly algorithm: TOtpAlgorithm;
  readonly digits: number;
  readonly period: number;
  readonly counter: number;
  /** Steam Guard: five symbols of its own alphabet instead of decimal digits. */
  readonly encoder: 'default' | 'steam';
}

export type TOtpUriError = 'not-otp' | 'bad-secret' | 'bad-parameter';

const DEFAULT_DIGITS = 6;
const STEAM_DIGITS = 5;
const DEFAULT_PERIOD = 30;
const ALLOWED_DIGITS: ReadonlySet<number> = new Set([6, 7, 8]);
const ALGORITHMS: ReadonlySet<string> = new Set<TOtpAlgorithm>(['SHA1', 'SHA256', 'SHA512']);
const BASE32_SECRET = /^[A-Z2-7]+$/;
const SECRET_NOISE = /[\s=-]/g;
const STEAM_SCHEME = 'steam://';

function normalizeSecret(secret: string): string {
  return secret.replace(SECRET_NOISE, '').toUpperCase();
}

function positiveInteger(value: string | null, fallback: number): number | null {
  if (isNil(value)) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

/** A malformed percent escape (`100%`) is a bad URI, not an exception. */
function decodeLabel(encoded: string): string | null {
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

function isAlgorithm(value: string): value is TOtpAlgorithm {
  return ALGORITHMS.has(value);
}

/** A bare base32 secret, as people paste it, becomes a TOTP with the defaults. */
export function isBareSecret(value: string): boolean {
  const secret = normalizeSecret(value);
  return secret.length > 0 && BASE32_SECRET.test(secret);
}

function parseSteam(value: string): TResult<IOtpParams, TOtpUriError> {
  const secret = normalizeSecret(value.slice(STEAM_SCHEME.length));
  return BASE32_SECRET.test(secret)
    ? ok({
        type: 'totp',
        label: 'Steam',
        issuer: 'Steam',
        secret,
        algorithm: 'SHA1',
        digits: STEAM_DIGITS,
        period: DEFAULT_PERIOD,
        counter: 0,
        encoder: 'steam',
      })
    : err('bad-secret');
}

/** `otpauth://totp|hotp/<label>?secret=…` (Key URI format) and Bitwarden's `steam://<secret>`. */
export function parseOtpUri(value: string): TResult<IOtpParams, TOtpUriError> {
  if (value.startsWith(STEAM_SCHEME)) {
    return parseSteam(value);
  }
  const url = parseUrl(value);
  if (
    isNil(url) ||
    url.protocol !== 'otpauth:' ||
    (url.hostname !== 'totp' && url.hostname !== 'hotp')
  ) {
    return err('not-otp');
  }
  const query = url.searchParams;
  const secret = normalizeSecret(query.get('secret') ?? '');
  if (!BASE32_SECRET.test(secret)) {
    return err('bad-secret');
  }
  const algorithm = (query.get('algorithm') ?? 'SHA1').toUpperCase();
  const steam = query.get('encoder') === 'steam';
  const digits = positiveInteger(query.get('digits'), DEFAULT_DIGITS);
  const period = positiveInteger(query.get('period'), DEFAULT_PERIOD);
  const counter = Number(query.get('counter') ?? '0');
  if (
    !isAlgorithm(algorithm) ||
    isNil(digits) ||
    isNil(period) ||
    !Number.isSafeInteger(counter) ||
    counter < 0
  ) {
    return err('bad-parameter');
  }
  if (!steam && !ALLOWED_DIGITS.has(digits)) {
    return err('bad-parameter');
  }
  const label = decodeLabel(url.pathname.replace(/^\//, ''));
  if (isNil(label)) {
    return err('bad-parameter');
  }
  return ok({
    type: url.hostname,
    label,
    issuer: query.get('issuer'),
    secret,
    algorithm,
    digits: steam ? STEAM_DIGITS : digits,
    period,
    counter,
    encoder: steam ? 'steam' : 'default',
  });
}

/** The one written form of a code's parameters: the value an `otp` field stores. */
export function formatOtpUri(params: IOtpParams): string {
  const query = new URLSearchParams({ secret: params.secret });
  if (!isNil(params.issuer)) {
    query.set('issuer', params.issuer);
  }
  query.set('algorithm', params.algorithm);
  query.set('digits', String(params.digits));
  if (params.type === 'totp') {
    query.set('period', String(params.period));
  } else {
    query.set('counter', String(params.counter));
  }
  if (params.encoder === 'steam') {
    query.set('encoder', 'steam');
  }
  return `otpauth://${params.type}/${encodeURIComponent(params.label)}?${query.toString()}`;
}

export function bareSecretToUri(secret: string, label: string): string {
  return formatOtpUri({
    type: 'totp',
    label,
    issuer: null,
    secret: normalizeSecret(secret),
    algorithm: 'SHA1',
    digits: DEFAULT_DIGITS,
    period: DEFAULT_PERIOD,
    counter: 0,
    encoder: 'default',
  });
}
