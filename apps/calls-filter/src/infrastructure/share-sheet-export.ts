import { Directory, File, Paths } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';

import type { TShareFile } from '../contexts/diagnostics/domain/ports/file-share';

const exportsDirectory = (): Directory => new Directory(Paths.cache, 'exports');

/**
 * Android has no save dialog an app can open with bytes: the file waits in the cache while
 * the share sheet hands it to a messenger, the mail or Files, and is deleted after.
 */
export const shareSheetExport: TShareFile = async ({ name, mime, text }) => {
  if (!(await isAvailableAsync())) {
    return 'unavailable';
  }
  const directory = exportsDirectory();
  try {
    directory.create({ idempotent: true });
    const file = new File(directory, name);
    file.create({ overwrite: true });
    file.write(text);
    await shareAsync(file.uri, { mimeType: mime, dialogTitle: name });
    return 'shared';
  } catch {
    return 'failed';
  } finally {
    if (directory.exists) {
      directory.delete();
    }
  }
};
