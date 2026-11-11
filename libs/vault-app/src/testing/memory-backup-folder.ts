import type { IBackupFileEntry, IBackupFolder } from '../interchange/domain/ports/backup-folder';

/** A device's backup folder in memory; a file's time is when it was written, in the test's clock. */
export function createMemoryBackupFolder(now: () => number): IBackupFolder & {
  readonly files: () => ReadonlyMap<string, Uint8Array<ArrayBuffer>>;
} {
  const files = new Map<string, { readonly bytes: Uint8Array<ArrayBuffer>; readonly at: number }>();
  return {
    location: '/storage/emulated/0/Android/data/vault.test/backup',
    files: () => new Map([...files].map(([name, file]) => [name, file.bytes])),
    list: () =>
      Promise.resolve(
        [...files].map(([name, file]): IBackupFileEntry => ({
          name,
          modifiedAt: file.at,
          size: file.bytes.byteLength,
        }))
      ),
    read: name => Promise.resolve(files.get(name)?.bytes ?? null),
    write: (name, bytes) => {
      files.set(name, { bytes, at: now() });
      return Promise.resolve(true);
    },
    remove: name => Promise.resolve(files.delete(name)),
  };
}
