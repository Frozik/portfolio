import type { TStorageError } from '@frozik/cloud-storage/core/storage-error';
import { storagePath } from '@frozik/cloud-storage/core/storage-path';
import type { IStorageProvider } from '@frozik/cloud-storage/core/storage-provider';
import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';
import type { IVaultRegistry, TVaultKey } from '@frozik/vault/persistence/ports';
import { vaultKeyOf } from '@frozik/vault/session/vault-key-of';
import { isNil } from 'lodash-es';

import { LOCAL_COPY_PATH } from '../domain/local-copy';
import type { ICloudConnection } from '../domain/ports/cloud';

export type TAdoptFailure =
  | { readonly kind: 'storage'; readonly error: TStorageError }
  | { readonly kind: 'not-found' }
  | { readonly kind: 'not-a-vault' }
  /** This device's stores refused the copy or the record. */
  | { readonly kind: 'device' };

const VAULT_EXTENSION = /\.pwv$/i;

function nameOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1).replace(VAULT_EXTENSION, '');
}

/**
 * A vault found in a cloud becomes one this device knows: the
 * file is downloaded as the local copy and listed under the vault id its
 * header names, so the usual unlock opens it. A vault already known here is
 * left as it is; linking it to this cloud follows the unlock. A local copy
 * the registry does not list is what a forgotten vault left: it is replaced.
 */
export async function adoptCloudVault(
  {
    connection,
    localCopyOf,
    registry,
  }: {
    readonly connection: ICloudConnection;
    readonly localCopyOf: (vaultKey: TVaultKey) => IStorageProvider;
    readonly registry: IVaultRegistry;
  },
  signal: AbortSignal
): Promise<TResult<TVaultKey, TAdoptFailure>> {
  const read = await connection.storage.read(storagePath(connection.location.path), signal);
  if (!read.ok) {
    return err({ kind: 'storage', error: read.error });
  }
  if (isNil(read.value)) {
    return err({ kind: 'not-found' });
  }
  const vaultKey = vaultKeyOf(read.value.bytes);
  if (isNil(vaultKey)) {
    return err({ kind: 'not-a-vault' });
  }
  const known = await registry.list();
  if (!known.ok) {
    return err({ kind: 'device' });
  }
  if (known.value.some(vault => vault.vaultKey === vaultKey)) {
    return ok(vaultKey);
  }
  const written = await localCopyOf(vaultKey).write(
    LOCAL_COPY_PATH,
    read.value.bytes,
    { kind: 'overwrite' },
    signal
  );
  if (!written.ok) {
    return err({ kind: 'device' });
  }
  const listed = await registry.put({
    vaultKey,
    name: nameOf(connection.location.path),
    description: '',
    lastOpenedAt: null,
    unsyncedChanges: false,
  });
  return listed.ok ? ok(vaultKey) : err({ kind: 'device' });
}
