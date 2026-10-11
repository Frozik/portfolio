import { toHex } from '../crypto/bytes';
import { decodeHeader } from '../format/header';
import type { TVaultKey } from '../persistence/ports';

/** The vault a file belongs to, read from its plaintext header before any password; `null` for a file that is not a vault. */
export function vaultKeyOf(file: Uint8Array<ArrayBuffer>): TVaultKey | null {
  const decoded = decodeHeader(file);
  return decoded.ok ? toHex(decoded.value.header.vaultId) : null;
}
