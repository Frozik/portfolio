import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';
import type { UnzipFileInfo, Zippable } from 'fflate';
import { unzipSync, zipSync } from 'fflate';

import type { TBytes } from '../crypto/bytes';

export interface IContainerEntry {
  readonly path: string;
  readonly bytes: TBytes;
  /** False for content that is already compressed (images, PDF, zip): stored as is. */
  readonly compress: boolean;
}

export type TContainerError = 'corrupted' | 'zip-limits';

/** Zip-bomb limits checked against the central directory before inflating. */
const MAX_ENTRIES = 20_000;
const MAX_TOTAL_BYTES = 64 * 1024 * 1024;
/** An archive the user exported with their files (blobs up to 50 MiB each): read for import, never kept. */
export const IMPORT_ARCHIVE_MAX_BYTES = 1024 * 1024 * 1024;
const MAX_COMPRESSION_RATIO = 100;
const MAX_PATH_LENGTH = 200;
const STORED = 0;
const DEFAULT_LEVEL = 6;
const SAFE_PATH = /^[\w.-]+(?:\/[\w.-]+)*$/;
const DOT_SEGMENT = /(?:^|\/)\.{1,2}(?:\/|$)/;
/**
 * One fixed timestamp for every entry: it tells nothing about when the vault
 * was written, and the archive of the same content is byte-identical. A
 * local-time string, because zip stores local DOS time.
 */
const ENTRY_MTIME = '1980-01-01T00:00:00';

/**
 * Any well-formed relative path, not only the names this version writes: a
 * newer schema may add files, and they must survive a round trip through an
 * older client.
 */
export function isSafeContainerPath(path: string): boolean {
  return path.length <= MAX_PATH_LENGTH && SAFE_PATH.test(path) && !DOT_SEGMENT.test(path);
}

export function packContainer(entries: readonly IContainerEntry[]): TBytes {
  const zippable: Zippable = {};
  for (const { path, bytes, compress } of entries) {
    zippable[path] = [bytes, { level: compress ? DEFAULT_LEVEL : STORED }];
  }
  return zipSync(zippable, { mtime: ENTRY_MTIME });
}

function isEntryWithinLimits(file: UnzipFileInfo): boolean {
  return (
    isSafeContainerPath(file.name) &&
    file.originalSize <= Math.max(file.size, 1) * MAX_COMPRESSION_RATIO
  );
}

/** Stops fflate's listing pass at the first entry over a limit: a zip64 directory may claim 2^32 entries. */
class ContainerOverLimits extends Error {}

/** The limits, checked entry by entry against the central directory before anything inflates. */
function checkLimits(zip: TBytes, maxTotalBytes: number): TResult<void, TContainerError> {
  let entries = 0;
  let total = 0;
  try {
    unzipSync(zip, {
      filter: file => {
        entries += 1;
        total += file.originalSize;
        if (entries > MAX_ENTRIES || total > maxTotalBytes || !isEntryWithinLimits(file)) {
          throw new ContainerOverLimits();
        }
        return false;
      },
    });
  } catch (error) {
    return err(error instanceof ContainerOverLimits ? 'zip-limits' : 'corrupted');
  }
  return ok(undefined);
}

export function unpackContainer(
  zip: TBytes,
  maxTotalBytes = MAX_TOTAL_BYTES
): TResult<ReadonlyMap<string, TBytes>, TContainerError> {
  const limits = checkLimits(zip, maxTotalBytes);
  if (!limits.ok) {
    return limits;
  }
  try {
    return ok(new Map(Object.entries(unzipSync(zip))));
  } catch {
    return err('corrupted');
  }
}
