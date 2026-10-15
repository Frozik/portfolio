import { isNil } from 'lodash-es';

import type {
  IVaultFile,
  TPickVaultFile,
} from '@frozik/vault-app/cloud/domain/ports/vault-file-picker';

const VAULT_FILE_TYPES = '.pwv,application/octet-stream';

/** A dropped or chosen file, read whole: a vault file is a few megabytes at most. */
export async function vaultFileOf(file: File): Promise<IVaultFile> {
  return { bytes: new Uint8Array(await file.arrayBuffer()), name: file.name };
}

/** The browser's own file chooser; it must open within the click that asked. */
export const pickVaultFileInBrowser: TPickVaultFile = () =>
  new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = VAULT_FILE_TYPES;
    input.addEventListener('cancel', () => resolve(null), { once: true });
    input.addEventListener(
      'change',
      () => {
        const file = input.files?.item(0);
        resolve(isNil(file) ? null : vaultFileOf(file));
      },
      { once: true }
    );
    input.click();
  });
