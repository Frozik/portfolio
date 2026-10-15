import { isNil } from 'lodash-es';

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

/**
 * The passkeys that open a vault file on this site, read from its plaintext
 * header before any password: another site's passkey could not answer here,
 * and one of an unknown site is offered for the browser to try.
 */
export function passkeysOf(file: Uint8Array<ArrayBuffer>, rpId: string): readonly TBytes[] {
  const decoded = decodeHeader(file);
  if (!decoded.ok) {
    return [];
  }
  return decoded.value.header.keyslots.flatMap(slot =>
    slot.kind === 'prf' && (isNil(slot.rpId) || slot.rpId === rpId) ? [slot.credentialId] : []
  );
}
