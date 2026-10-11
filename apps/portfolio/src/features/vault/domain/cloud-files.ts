import { storagePath } from '@frozik/cloud-storage/core/storage-path';
import type { TStoragePath } from '@frozik/cloud-storage/core/storage-provider';
/** Where a vault lives in a cloud; never a password or a token. On the device it is sealed with the vault's key. */
export type TCloudLocation =
  | {
      readonly kind: 'google-drive';
      /** A visible folder in My Drive, or the app's hidden one. */
      readonly space: 'my-drive' | 'app-data';
      readonly path: string;
    }
  | {
      readonly kind: 'webdav';
      readonly url: string;
      readonly username: string;
      readonly path: string;
    };

/** The folder a vault lives in, in either Drive space. */
export const DRIVE_VAULT_FOLDER: TStoragePath = storagePath('Vault');

const VAULT_EXTENSION = '.pwv';

/** A vault file is told apart by its extension; its header says the rest once opened. */
export function isVaultFile(path: TStoragePath): boolean {
  return path.toLowerCase().endsWith(VAULT_EXTENSION);
}

/** Characters no cloud takes in a file name (Windows' set, the strictest a synced folder may meet). */
const UNSAFE_IN_FILE_NAME = /[\\/:*?"<>|]/g;
/** Below the space: control characters, refused everywhere. */
const FIRST_PRINTABLE = 0x20;
const FALLBACK_NAME = 'Vault';

/** The file a vault gets in a cloud folder: its name, made safe, with the `.pwv` extension. */
export function vaultFileName(vaultName: string): string {
  const printable = [...vaultName]
    .map(character => ((character.codePointAt(0) ?? 0) < FIRST_PRINTABLE ? '-' : character))
    .join('');
  const safe = printable.replace(UNSAFE_IN_FILE_NAME, '-').trim();
  return `${safe === '' ? FALLBACK_NAME : safe}${VAULT_EXTENSION}`;
}
