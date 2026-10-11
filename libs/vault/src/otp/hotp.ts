import type { TOtpAlgorithm } from '../model/validation/otpauth-uri';

const COUNTER_BYTES = 8;
const OFFSET_MASK = 0x0f;
const TRUNCATION_MASK = 0x7fffffff;
const DECIMAL = 10;
/** Steam Guard writes five symbols of its own alphabet. */
const STEAM_ALPHABET = '23456789BCDFGHJKMNPQRTVWXY';
const STEAM_LENGTH = 5;

const HASHES: Readonly<Record<TOtpAlgorithm, string>> = {
  SHA1: 'SHA-1',
  SHA256: 'SHA-256',
  SHA512: 'SHA-512',
};

/** RFC 4226 §5.3 — HMAC of the counter and dynamic truncation to 31 bits. */
async function truncatedHmac(
  secret: Uint8Array<ArrayBuffer>,
  counter: number,
  algorithm: TOtpAlgorithm
): Promise<number> {
  const key = await crypto.subtle.importKey(
    'raw',
    secret,
    { name: 'HMAC', hash: HASHES[algorithm] },
    false,
    ['sign']
  );
  const message = new Uint8Array(COUNTER_BYTES);
  new DataView(message.buffer).setBigUint64(0, BigInt(counter));
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, message));
  const offset = (digest.at(-1) ?? 0) & OFFSET_MASK;
  return new DataView(digest.buffer).getUint32(offset) & TRUNCATION_MASK;
}

export type TOtpEncoding =
  | { readonly kind: 'decimal'; readonly digits: number }
  | { readonly kind: 'steam' };

function encode(value: number, encoding: TOtpEncoding): string {
  if (encoding.kind === 'decimal') {
    return String(value % DECIMAL ** encoding.digits).padStart(encoding.digits, '0');
  }
  let rest = value;
  let code = '';
  for (let index = 0; index < STEAM_LENGTH; index += 1) {
    code += STEAM_ALPHABET[rest % STEAM_ALPHABET.length];
    rest = Math.floor(rest / STEAM_ALPHABET.length);
  }
  return code;
}

/** RFC 4226 — the code for one counter value; TOTP feeds it the time step (RFC 6238). */
export async function hotpCode(
  secret: Uint8Array<ArrayBuffer>,
  counter: number,
  algorithm: TOtpAlgorithm,
  encoding: TOtpEncoding
): Promise<string> {
  return encode(await truncatedHmac(secret, counter, algorithm), encoding);
}
