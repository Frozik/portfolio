import type { TStoragePath } from './storage-provider';

const SEPARATOR = '/';

export function storagePath(path: string): TStoragePath {
  return path as TStoragePath;
}

/** Whether `path` sits directly in `directory` (not deeper): what `list` returns. */
export function isDirectChild(path: TStoragePath, directory: TStoragePath): boolean {
  const prefix =
    directory === '' || directory.endsWith(SEPARATOR) ? directory : directory + SEPARATOR;
  return (
    path.startsWith(prefix) &&
    !path.slice(prefix.length).includes(SEPARATOR) &&
    path.length > prefix.length
  );
}
