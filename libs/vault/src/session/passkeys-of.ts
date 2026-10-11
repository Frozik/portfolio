import type { TBytes } from '../crypto/bytes';
import { utf8 } from '../crypto/bytes';
import { decodeHeader } from '../format/header';
import type { TVaultKey } from '../persistence/ports';

/**
 * What the passkey's PRF is evaluated over for this vault: the
 * same on every device and known before unlock, so the browser's prompt can
 * open straight from the click, with nothing to wait for first.
 */
export function passkeySalt(vaultKey: TVaultKey): TBytes {
  return utf8(`pwv/prf/${vaultKey}`);
}

/** The passkeys that open a vault file, read from its plaintext header before any password. */
export function passkeysOf(file: Uint8Array<ArrayBuffer>): readonly TBytes[] {
  const decoded = decodeHeader(file);
  if (!decoded.ok) {
    return [];
  }
  return decoded.value.header.keyslots.flatMap(slot =>
    slot.kind === 'prf' ? [slot.credentialId] : []
  );
}
