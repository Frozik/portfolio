import type { TReadQrCode } from '@frozik/vault-app/document/domain/ports/qr-reader';
import { scanFromURLAsync } from 'expo-camera';
import { Directory, File, Paths } from 'expo-file-system';

const scansDirectory = (): Directory => new Directory(Paths.cache, 'qr-scans');

/** A picture holding a secret is on disk only while it is read; a scan the process died in is cleared at the next start. */
export function clearLeftoverQrScans(): void {
  const directory = scansDirectory();
  if (directory.exists) {
    directory.delete();
  }
}

/** ML Kit, through expo-camera, reads only a file: the picture waits in the cache for as long as that takes. */
export const mlKitReadQrCode: TReadQrCode = async ({ bytes }) => {
  try {
    const directory = scansDirectory();
    directory.create({ idempotent: true });
    const file = new File(directory, 'picture');
    file.create({ overwrite: true });
    file.write(bytes);
    const [code] = await scanFromURLAsync(file.uri, ['qr']);
    return code?.data ?? null;
  } catch {
    return null;
  } finally {
    clearLeftoverQrScans();
  }
};
