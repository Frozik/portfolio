import type { TPickVaultFile } from '@frozik/vault-app/cloud/domain/ports/vault-file-picker';

import { pickOneFile } from '../device-files/pick-files';

/** The vault's local copy is kept by the device stores; the chooser's copy goes at once. */
export const pickVaultFileFromDocuments: TPickVaultFile = async () => {
  const file = await pickOneFile();
  return file === null ? null : { name: file.name, bytes: file.bytes };
};
