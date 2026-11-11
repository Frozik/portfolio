import type { TSaveFile } from '@frozik/vault-app/interchange/domain/ports/file-saver';
import { Directory } from 'expo-file-system';

import { safeFileName } from './safe-file-name';

/**
 * A file written into a folder the user picks in the system's own picker — Downloads, a card, a
 * cloud's folder — with its name; a folder that already has one gets a numbered copy from the
 * system. Closing the picker saves nothing.
 */
export const pickedFolderSaveFile: TSaveFile = async ({ name, mime, bytes }) => {
  let folder: Directory;
  try {
    folder = await Directory.pickDirectoryAsync();
  } catch {
    return 'cancelled';
  }
  try {
    folder.createFile(safeFileName(name), mime).write(bytes);
    return 'saved';
  } catch {
    return 'unavailable';
  }
};
