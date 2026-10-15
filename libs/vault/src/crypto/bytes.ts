/** Bytes backed by a plain `ArrayBuffer` — the only kind WebCrypto and `postMessage` transfer accept. */
export type TBytes = Uint8Array<ArrayBuffer>;

export function concatBytes(...parts: readonly Uint8Array[]): TBytes {
  const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

export function bytesEqual(first: Uint8Array, second: Uint8Array): boolean {
  return first.length === second.length && first.every((byte, index) => byte === second[index]);
}

export function utf8(text: string): TBytes {
  return new TextEncoder().encode(text);
}

/** Strict UTF-8: `null` for bytes that are not valid text instead of U+FFFD replacements. */
export function utf8Text(bytes: Uint8Array): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

const HEX_RADIX = 16;

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(HEX_RADIX).padStart(2, '0')).join('');
}

const HEX_DIGITS = /^(?:[0-9a-f]{2})*$/i;

/** Strict hex: `null` for anything but whole lowercase or uppercase byte pairs. */
export function fromHexBytes(hex: string): TBytes | null {
  if (!HEX_DIGITS.test(hex)) {
    return null;
  }
  return Uint8Array.from(hex.match(/.{2}/g) ?? [], pair => Number.parseInt(pair, HEX_RADIX));
}

const BASE64_URL = /^[A-Za-z0-9_-]*$/;

/** RFC 4648 §4, padded: what a `data:` URI carries. */
export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

export function fromBase64(text: string): TBytes | null {
  try {
    return Uint8Array.from(atob(text), character => character.charCodeAt(0));
  } catch {
    return null;
  }
}

/** RFC 4648 §5 without padding: how CXF writes ids, hashes and keys. */
export function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function fromBase64Url(text: string): TBytes | null {
  if (!BASE64_URL.test(text)) {
    return null;
  }
  return fromBase64(text.replaceAll('-', '+').replaceAll('_', '/'));
}
