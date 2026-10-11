import type { Milliseconds } from '@frozik/utils/date/types';
import { err, ok } from '@frozik/utils/result/result';
import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

import { LOCAL_CAPABILITIES } from '../core/capabilities';
import type { TStorageResult } from '../core/storage-error';
import { isDirectChild } from '../core/storage-path';
import type {
  IStorageObjectStat,
  IStorageProvider,
  TRemoveResult,
  TStoragePath,
  TStorageRev,
  TWriteResult,
} from '../core/storage-provider';
import { isPreconditionMet } from '../core/write-precondition';

interface IStoredObject {
  readonly bytes: Uint8Array<ArrayBuffer>;
  readonly stat: IStorageObjectStat;
}

const ABORTED = err({ kind: 'aborted' } as const);

function nowMs(): Milliseconds {
  return Temporal.Now.instant().epochMilliseconds as Milliseconds;
}

/**
 * A provider in memory for tests: a real compare-and-swap,
 * bytes copied in and out so a caller can never alter what is stored.
 */
export function createMemoryProvider({
  now = nowMs,
}: { readonly now?: () => Milliseconds } = {}): IStorageProvider {
  const objects = new Map<TStoragePath, IStoredObject>();
  let revision = 0;
  const statOf = (path: TStoragePath): IStorageObjectStat | null => objects.get(path)?.stat ?? null;
  const guarded = async <T>(
    signal: AbortSignal,
    run: () => TStorageResult<T>
  ): Promise<TStorageResult<T>> => (signal.aborted ? ABORTED : run());

  return {
    kind: 'memory',
    capabilities: LOCAL_CAPABILITIES,
    stat: (path, signal) => guarded(signal, () => ok(statOf(path))),
    read: (path, signal) =>
      guarded(signal, () => {
        const stored = objects.get(path);
        return ok(isNil(stored) ? null : { bytes: stored.bytes.slice(), stat: stored.stat });
      }),
    write: (path, bytes, precondition, signal) =>
      guarded<TWriteResult>(signal, () => {
        const current = statOf(path);
        if (!isPreconditionMet(precondition, current)) {
          return ok({ kind: 'conflict', current });
        }
        revision += 1;
        const stat = {
          path,
          rev: String(revision) as TStorageRev,
          size: bytes.length,
          modifiedAt: now(),
        };
        objects.set(path, { bytes: bytes.slice(), stat });
        return ok({ kind: 'ok', stat });
      }),
    remove: (path, precondition, signal) =>
      guarded<TRemoveResult>(signal, () => {
        const current = statOf(path);
        if (isNil(current)) {
          return err({ kind: 'not-found' });
        }
        if (!isPreconditionMet(precondition, current)) {
          return ok({ kind: 'conflict', current });
        }
        objects.delete(path);
        return ok({ kind: 'removed' });
      }),
    list: (directory, signal) =>
      guarded(signal, () =>
        ok(
          [...objects.values()]
            .map(stored => stored.stat)
            .filter(stat => isDirectChild(stat.path, directory))
            .sort((first, second) => (first.path < second.path ? -1 : 1))
        )
      ),
  };
}
