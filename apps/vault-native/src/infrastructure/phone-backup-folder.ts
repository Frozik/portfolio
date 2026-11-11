import type { IBackupFolder } from '@frozik/vault-app/interchange/domain/ports/backup-folder';

import { VAULT_FILES } from '../../modules/vault-files/src/VaultFilesModule';

/** The folder beside the app's data in shared storage; anything the folder refuses reads as nothing done. */
export function phoneBackupFolder(): IBackupFolder {
  return {
    location: VAULT_FILES.backupLocation(),
    list: () => VAULT_FILES.listBackups().catch(() => null),
    read: name => VAULT_FILES.readBackup(name).catch(() => null),
    write: (name, bytes) => VAULT_FILES.writeBackup(name, bytes).catch(() => false),
    remove: name => VAULT_FILES.deleteBackup(name).catch(() => false),
  };
}
