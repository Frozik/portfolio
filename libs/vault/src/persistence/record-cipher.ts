import { parseJson } from '@frozik/utils/parseJson';
import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';
import { isNil } from 'lodash-es';

import { NONCE_BYTES, openBlock, sealBlock } from '../crypto/aead';
import type { TBytes } from '../crypto/bytes';
import { concatBytes, utf8, utf8Text } from '../crypto/bytes';
import type { IRandom } from '../ports/random';
import type { TVaultKey } from './ports';

/**
 * A device record sealed with AES-GCM under its subkey. The
 * additional data names the vault and the record, so sealed bytes moved to
 * another slot of the store no longer open.
 */
function recordAdditionalData(vaultKey: TVaultKey, recordKey: string): TBytes {
  return utf8(`pwv/record/${vaultKey}/${recordKey}`);
}

export async function sealRecord(
  key: CryptoKey,
  { vaultKey, recordKey }: { readonly vaultKey: TVaultKey; readonly recordKey: string },
  value: unknown,
  random: IRandom
): Promise<TBytes> {
  const nonce = random.bytes(NONCE_BYTES);
  const sealed = await sealBlock(
    key,
    nonce,
    utf8(JSON.stringify(value)),
    recordAdditionalData(vaultKey, recordKey)
  );
  return concatBytes(nonce, sealed);
}

export async function openRecord(
  key: CryptoKey,
  { vaultKey, recordKey }: { readonly vaultKey: TVaultKey; readonly recordKey: string },
  sealed: TBytes
): Promise<TResult<unknown, 'corrupted'>> {
  const opened = await openBlock(
    key,
    sealed.slice(0, NONCE_BYTES),
    sealed.slice(NONCE_BYTES),
    recordAdditionalData(vaultKey, recordKey)
  );
  if (!opened.ok) {
    return err('corrupted');
  }
  const value = parseJson<unknown>(utf8Text(opened.value));
  return isNil(value) ? err('corrupted') : ok(value);
}
