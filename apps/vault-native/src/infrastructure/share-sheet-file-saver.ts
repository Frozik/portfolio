import type { TSaveFile } from '@frozik/vault-app/interchange/domain/ports/file-saver';
import { Directory, File, Paths } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';

const exportsDirectory = (): Directory => new Directory(Paths.cache, 'exports');

/** A vault may be named "Work/Home": a path separator or a control character never reaches the file system. */
const UNSAFE_IN_FILE_NAME = /[/\\\p{Cc}]/gu;

/**
 * An export is plaintext for as long as it waits for the share sheet. A lock
 * or Android itself may end the process while the sheet is open, before the
 * save could clean up, so each start clears what was left.
 */
export function clearLeftoverExports(): void {
  const directory = exportsDirectory();
  if (directory.exists) {
    directory.delete();
  }
}

/**
 * Android has no save dialog an app can open with bytes: the file waits in the
 * app's cache while the share sheet hands it to Files, Drive or a mail, and is
 * deleted the moment the sheet closes. The sheet does not say whether the
 * user picked a target, so a closed sheet counts as saved.
 */
export const shareSheetSaveFile: TSaveFile = async ({ name, mime, bytes }) => {
  if (!(await isAvailableAsync())) {
    return 'unavailable';
  }
  try {
    const directory = exportsDirectory();
    directory.create({ idempotent: true });
    const file = new File(directory, name.replace(UNSAFE_IN_FILE_NAME, '-'));
    file.create({ overwrite: true });
    file.write(bytes);
    await shareAsync(file.uri, { mimeType: mime, dialogTitle: name });
    return 'saved';
  } catch {
    return 'unavailable';
  } finally {
    clearLeftoverExports();
  }
};
