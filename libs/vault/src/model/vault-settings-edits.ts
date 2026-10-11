import type { IHlc } from './hlc';
import type { IVaultDocument } from './vault-document';

/** The vault's name, synchronised: the later rename wins. */
export function renameVault(document: IVaultDocument, name: string, at: IHlc): IVaultDocument {
  const trimmed = name.trim();
  if (trimmed === '' || trimmed === document.settings.name) {
    return document;
  }
  return { ...document, settings: { ...document.settings, name: trimmed, updatedAt: at } };
}
