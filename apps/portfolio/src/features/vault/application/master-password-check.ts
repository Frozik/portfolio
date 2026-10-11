import type { IStorageProvider } from '@frozik/cloud-storage/core/storage-provider';
import type { IVaultCodec } from '@frozik/vault/codec/vault-codec';
import { bytesEqual } from '@frozik/vault/crypto/bytes';
import { encodePassword } from '@frozik/vault/crypto/password-normalization';
import type { TUnlockFailure } from '@frozik/vault/lifecycle/lifecycle-state';
import { unlockFailureOf } from '@frozik/vault/session/unlock-failure';
import { isNil } from 'lodash-es';

import { LOCAL_COPY_PATH } from '../domain/local-copy';

/**
 * The master password typed again, checked by opening the
 * local copy with it in the Worker; it must unwrap this session's key, not
 * merely some key. The reason it failed, or `null` when it is right.
 */
export async function checkMasterPassword(
  {
    localCopy,
    codec,
    keyId,
  }: {
    readonly localCopy: IStorageProvider;
    readonly codec: IVaultCodec;
    readonly keyId: Uint8Array;
  },
  password: string,
  signal: AbortSignal
): Promise<TUnlockFailure | null> {
  const read = await localCopy.read(LOCAL_COPY_PATH, signal);
  if (!read.ok || isNil(read.value)) {
    return 'unavailable';
  }
  const opened = await codec.open(
    read.value.bytes,
    { kind: 'password', password: encodePassword(password) },
    signal
  );
  if (!opened.ok) {
    return unlockFailureOf(opened.error);
  }
  return bytesEqual(opened.value.keys.keyId, keyId) ? null : 'wrong-password';
}
