import type { IHlc } from './hlc';
import type { IVaultDocument } from './vault-document';

export interface IVaultTitle {
  readonly name: string;
  readonly description: string;
}

/** The vault's name and description, synchronised together: the later edit wins. */
export function renameVault(
  document: IVaultDocument,
  title: IVaultTitle,
  at: IHlc
): IVaultDocument {
  const name = title.name.trim();
  const description = title.description.trim();
  const { settings } = document;
  if (name === '' || (name === settings.name && description === settings.description)) {
    return document;
  }
  return { ...document, settings: { ...settings, name, description, updatedAt: at } };
}
