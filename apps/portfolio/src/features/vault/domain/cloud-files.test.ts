import { storagePath } from '@frozik/cloud-storage/core/storage-path';

import { isVaultFile, vaultFileName } from './cloud-files';

describe('vault files in a cloud', () => {
  it('names the file after the vault, without characters a cloud refuses', () => {
    expect(vaultFileName('Family')).toBe('Family.pwv');
    expect(vaultFileName('Work: a/b')).toBe('Work- a-b.pwv');
    expect(vaultFileName('  ')).toBe('Vault.pwv');
    expect(vaultFileName('Tab\there')).toBe('Tab-here.pwv');
  });

  it('tells a vault file by its extension, whatever the case', () => {
    expect(isVaultFile(storagePath('Vault/Family.PWV'))).toBe(true);
    expect(isVaultFile(storagePath('Vault/notes.txt'))).toBe(false);
  });
});
