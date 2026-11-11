import type { TFollowIncomingFiles } from '@frozik/vault-app/cloud/domain/ports/vault-file-picker';

import { VAULT_FILES } from '../../modules/vault-files/src/VaultFilesModule';

/** The file that started the app, then each one Android hands over while it runs. */
export const followIncomingFiles: TFollowIncomingFiles = onFile => {
  const take = (): void => {
    void VAULT_FILES.takeIncomingFile().then(file => {
      if (file !== null) {
        onFile(file);
      }
    });
  };
  take();
  const subscription = VAULT_FILES.addListener('onIncomingFile', take);
  return () => subscription.remove();
};
