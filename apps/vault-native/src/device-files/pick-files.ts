import { getDocumentAsync } from 'expo-document-picker';
import { File } from 'expo-file-system';

export interface IPickedFile {
  readonly name: string;
  readonly type: string;
  readonly bytes: Uint8Array<ArrayBuffer>;
}

const UNKNOWN_TYPE = 'application/octet-stream';

/**
 * Android's document chooser: Files, Drive, a USB stick. Each chosen file is
 * copied into the app's cache to be read, and the copy deleted at once.
 */
export async function pickFiles(multiple: boolean): Promise<readonly IPickedFile[]> {
  const picked = await getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple });
  if (picked.canceled) {
    return [];
  }
  return Promise.all(
    picked.assets.map(async asset => {
      const copy = new File(asset.uri);
      try {
        return {
          name: asset.name,
          type: asset.mimeType ?? UNKNOWN_TYPE,
          bytes: await copy.bytes(),
        };
      } finally {
        if (copy.exists) {
          copy.delete();
        }
      }
    })
  );
}

export async function pickOneFile(): Promise<IPickedFile | null> {
  const [file] = await pickFiles(false);
  return file ?? null;
}
