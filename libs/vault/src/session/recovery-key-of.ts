import { decodeHeader } from '../format/header';

/**
 * Whether a recovery key may open a locked vault file, read from its plaintext header before any
 * password. A header that cannot be read is not taken as a "no": the key is still offered to try.
 */
export function opensWithRecoveryKey(file: Uint8Array<ArrayBuffer>): boolean {
  const decoded = decodeHeader(file);
  return !decoded.ok || decoded.value.header.keyslots.some(slot => slot.kind === 'recovery');
}
