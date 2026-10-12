import { storagePath } from '@frozik/cloud-storage/core/storage-path';
import type { TStoragePath } from '@frozik/cloud-storage/core/storage-provider';

/** The folder a vault lives in by default; the hidden space always uses it. */
export const DRIVE_VAULT_FOLDER: TStoragePath = storagePath('Vault');

const DRIVE_SEPARATOR = '/';
const NOT_A_FOLDER_NAME: ReadonlySet<string> = new Set(['.', '..']);

/**
 * A folder typed for My Drive, nested by slashes: names trimmed, empty ones
 * dropped; `null` when nothing is left or a name is `.`, `..` or holds a
 * control character.
 */
export function driveFolderOf(typed: string): TStoragePath | null {
  const names = typed
    .split(DRIVE_SEPARATOR)
    .map(name => name.trim())
    .filter(name => name !== '');
  const valid =
    names.length > 0 &&
    names.every(name => !NOT_A_FOLDER_NAME.has(name) && ![...name].some(isControlCharacter));
  return valid ? storagePath(names.join(DRIVE_SEPARATOR)) : null;
}

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

function isControlCharacter(character: string): boolean {
  return (character.codePointAt(0) ?? 0) < FIRST_PRINTABLE;
}

/** The file a vault gets in a cloud folder: its name, made safe, with the `.pwv` extension. */
export function vaultFileName(vaultName: string): string {
  const printable = [...vaultName]
    .map(character => (isControlCharacter(character) ? '-' : character))
    .join('');
  const safe = printable.replace(UNSAFE_IN_FILE_NAME, '-').trim();
  return `${safe === '' ? FALLBACK_NAME : safe}${VAULT_EXTENSION}`;
}
