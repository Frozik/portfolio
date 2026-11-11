import { vaultKeyOf } from '@frozik/vault/session/vault-key-of';
import { useRouter } from 'expo-router';
import { isNil } from 'lodash-es';

import type { IVaultFile } from '@frozik/vault-app/cloud/domain/ports/vault-file-picker';
import { createVaultPaths } from '@frozik/vault-app/navigation/vault-paths';

import { useAppModel } from '../app-model';

const paths = createVaultPaths('');

/**
 * A file handed to the app: a vault of its own opens at its unlock (or the first screen says why
 * not); anything else — another manager's database or export — waits while the user picks the
 * vault it goes into, or makes a new one for it.
 */
export function useTakeInFile(): (file: IVaultFile) => void {
  const { app, pendingImport } = useAppModel();
  const router = useRouter();
  return file => {
    const opening = app.fileOpening;
    if (!isNil(vaultKeyOf(file.bytes)) && !isNil(opening)) {
      void opening.adopt(file).then(vaultKey => {
        router.navigate(isNil(vaultKey) ? '/' : paths.vault(vaultKey));
      });
      return;
    }
    pendingImport.hold(file);
    router.navigate(paths.takeIn());
  };
}
