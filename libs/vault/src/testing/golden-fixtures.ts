import type { TBytes } from '../crypto/bytes';
import { encodePassword } from '../crypto/password-normalization';

/** The password of every golden fixture; non-ASCII on purpose, to pin its NFC encoding. */
export const GOLDEN_PASSWORD = encodePassword('Golden fixture · пароль · v1.0');

export const GOLDEN_SAMPLE_SEED = 42;
export const GOLDEN_KEYS_SEED = 2026;
export const GOLDEN_CREATED_AT = '2026-10-11T00:00:00Z';

/**
 * What a newer version wrote into `future-schema.pwv`. An older client opens
 * it read-only: it shows what it can, never fails on the rest,
 * and never writes the file back.
 */
export const FUTURE_PARTS = {
  manifestKey: { futureManifestKey: { introducedIn: 2 } },
  cardKey: { futureCardKey: 'ignored by v1' },
  fieldSpec: { kind: 'passkey', rpId: 'example.com' },
  bankCodeSpec: { kind: 'bank-code', scheme: 'clabe' },
  file: { path: 'future/index.json', text: '{"from":"schema 2"}' },
  tlv: { type: 0x40, skippable: true, text: 'future header record' },
} as const;

/** A fixture imported with `?inline` arrives as a base64 data URL in vitest and in the browser alike. */
export function bytesOfDataUrl(dataUrl: string): TBytes {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}
