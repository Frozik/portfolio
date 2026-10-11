import { openVersionedDatabase } from '@frozik/utils/database';
import type { Milliseconds } from '@frozik/utils/date/types';
import { err, ok } from '@frozik/utils/result/result';
import type { DBSchema, IDBPDatabase, IDBPTransaction, StoreNames } from 'idb';
import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

import { LOCAL_CAPABILITIES } from '../core/capabilities';
import type { TStorageResult } from '../core/storage-error';
import { isDirectChild } from '../core/storage-path';
import type {
  IStorageObjectStat,
  IStorageProvider,
  TRemoveResult,
  TStorageRev,
  TWriteResult,
} from '../core/storage-provider';
import { isPreconditionMet } from '../core/write-precondition';

/** v1 kept the bytes in the object row: what the upgrade to v2 moves out. */
interface IStoredObjectV1 extends IStorageObjectStat {
  readonly bytes?: Uint8Array<ArrayBuffer>;
}

interface IObjectsSchema extends DBSchema {
  /** Stats only: `list` must not read every file's bytes to name them (50 MiB blobs). */
  objects: { key: string; value: IStorageObjectStat };
  contents: { key: string; value: Uint8Array<ArrayBuffer> };
  counters: { key: string; value: number };
}

const SCHEMA_VERSION = 2;
const BYTES_APART_VERSION = 2;
const REVISION_COUNTER = 'revision';
const QUOTA_ERROR = 'QuotaExceededError';

function nowMs(): Milliseconds {
  return Temporal.Now.instant().epochMilliseconds as Milliseconds;
}

function statOf({ path, rev, size, modifiedAt }: IStorageObjectStat): IStorageObjectStat {
  return { path, rev, size, modifiedAt };
}

async function moveBytesApart(
  transaction: IDBPTransaction<IObjectsSchema, StoreNames<IObjectsSchema>[], 'versionchange'>
): Promise<void> {
  const contents = transaction.objectStore('contents');
  let cursor = await transaction.objectStore('objects').openCursor();
  while (!isNil(cursor)) {
    const stored: IStoredObjectV1 = cursor.value;
    if (!isNil(stored.bytes)) {
      await contents.put(stored.bytes, stored.path);
      await cursor.update(statOf(stored));
    }
    cursor = await cursor.continue();
  }
}

function openObjects(name: string): Promise<IDBPDatabase<IObjectsSchema>> {
  return openVersionedDatabase<IObjectsSchema>(
    name,
    SCHEMA_VERSION,
    (database, oldVersion, transaction) => {
      if (!database.objectStoreNames.contains('objects')) {
        database.createObjectStore('objects', { keyPath: 'path' });
      }
      if (!database.objectStoreNames.contains('counters')) {
        database.createObjectStore('counters');
      }
      if (!database.objectStoreNames.contains('contents')) {
        database.createObjectStore('contents');
      }
      if (oldVersion > 0 && oldVersion < BYTES_APART_VERSION) {
        void moveBytesApart(transaction);
      }
    }
  );
}

/**
 * The device-local copy behind the same port as a cloud: the
 * precondition is checked and the write done in one IndexedDB transaction, a
 * real compare-and-swap; revisions come from one counter for the whole
 * store, so a file deleted and created again never repeats one. Platform
 * failures come back as values: a full disk is `quota`, a blocked store `unavailable`.
 */
export function createIndexedDbProvider(
  name: string,
  { now = nowMs }: { readonly now?: () => Milliseconds } = {}
): IStorageProvider {
  let database: Promise<IDBPDatabase<IObjectsSchema>> | null = null;
  const run = async <T>(
    signal: AbortSignal,
    work: (db: IDBPDatabase<IObjectsSchema>) => Promise<TStorageResult<T>>
  ): Promise<TStorageResult<T>> => {
    if (signal.aborted) {
      return err({ kind: 'aborted' });
    }
    try {
      database ??= openObjects(name);
      return await work(await database);
    } catch (error) {
      database = null;
      return err(
        error instanceof Error && error.name === QUOTA_ERROR
          ? { kind: 'quota' }
          : { kind: 'unavailable' }
      );
    }
  };

  return {
    kind: 'indexeddb',
    capabilities: LOCAL_CAPABILITIES,
    stat: (path, signal) =>
      run(signal, async db => {
        const stored = await db.get('objects', path);
        return ok(isNil(stored) ? null : statOf(stored));
      }),
    read: (path, signal) =>
      run(signal, async db => {
        const transaction = db.transaction(['objects', 'contents'], 'readonly');
        const [stored, bytes] = await Promise.all([
          transaction.objectStore('objects').get(path),
          transaction.objectStore('contents').get(path),
        ]);
        await transaction.done;
        return ok(isNil(stored) || isNil(bytes) ? null : { bytes, stat: statOf(stored) });
      }),
    write: (path, bytes, precondition, signal) =>
      run<TWriteResult>(signal, async db => {
        const transaction = db.transaction(['objects', 'contents', 'counters'], 'readwrite');
        const stored = await transaction.objectStore('objects').get(path);
        const current = isNil(stored) ? null : statOf(stored);
        if (!isPreconditionMet(precondition, current)) {
          await transaction.done;
          return ok({ kind: 'conflict', current });
        }
        const revision =
          ((await transaction.objectStore('counters').get(REVISION_COUNTER)) ?? 0) + 1;
        const stat: IStorageObjectStat = {
          path,
          rev: String(revision) as TStorageRev,
          size: bytes.length,
          modifiedAt: now(),
        };
        await transaction.objectStore('counters').put(revision, REVISION_COUNTER);
        await transaction.objectStore('objects').put(stat);
        await transaction.objectStore('contents').put(bytes.slice(), path);
        await transaction.done;
        return ok({ kind: 'ok', stat });
      }),
    remove: (path, precondition, signal) =>
      run<TRemoveResult>(signal, async db => {
        const transaction = db.transaction(['objects', 'contents'], 'readwrite');
        const objects = transaction.objectStore('objects');
        const stored = await objects.get(path);
        if (isNil(stored)) {
          await transaction.done;
          return err({ kind: 'not-found' });
        }
        if (!isPreconditionMet(precondition, statOf(stored))) {
          await transaction.done;
          return ok({ kind: 'conflict', current: statOf(stored) });
        }
        await objects.delete(path);
        await transaction.objectStore('contents').delete(path);
        await transaction.done;
        return ok({ kind: 'removed' });
      }),
    list: (directory, signal) =>
      run(signal, async db =>
        ok(
          (await db.getAll('objects'))
            .filter(stored => isDirectChild(stored.path, directory))
            .map(statOf)
            .sort((first, second) => (first.path < second.path ? -1 : 1))
        )
      ),
  };
}
