import type { Milliseconds } from '@frozik/utils/date/types';
import { err, ok } from '@frozik/utils/result/result';
import type { ISqlDriver, ISqlStatements, TSqlRow } from '@frozik/utils/sql/sql-driver';
import { bytesOf, numberOf, textOf } from '@frozik/utils/sql/sql-row';
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

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS storage_objects (
    namespace TEXT NOT NULL,
    path TEXT NOT NULL,
    bytes BLOB NOT NULL,
    rev TEXT NOT NULL,
    size INTEGER NOT NULL,
    modified_at INTEGER NOT NULL,
    PRIMARY KEY (namespace, path)
  )`,
  `CREATE TABLE IF NOT EXISTS storage_revisions (
    namespace TEXT PRIMARY KEY,
    last INTEGER NOT NULL
  )`,
] as const;

const ABORTED = err({ kind: 'aborted' } as const);

function nowMs(): Milliseconds {
  return Temporal.Now.instant().epochMilliseconds as Milliseconds;
}

function statOf(row: TSqlRow): IStorageObjectStat | null {
  const path = textOf(row, 'path');
  const rev = textOf(row, 'rev');
  const size = numberOf(row, 'size');
  const modifiedAt = numberOf(row, 'modified_at');
  return isNil(path) || isNil(rev) || isNil(size) || isNil(modifiedAt)
    ? null
    : {
        path: path as TStoragePath,
        rev: rev as TStorageRev,
        size,
        modifiedAt: modifiedAt as Milliseconds,
      };
}

/**
 * A provider over SQLite — a phone's local copy — with the same
 * compare-and-swap as the others: each write a transaction that checks the
 * precondition and counts the revision. One database serves several
 * providers, each in its own `namespace` (a vault's local copy).
 */
export function createSqlProvider({
  driver,
  namespace,
  now = nowMs,
}: {
  readonly driver: ISqlDriver;
  readonly namespace: string;
  readonly now?: () => Milliseconds;
}): IStorageProvider {
  let schema: Promise<void> | null = null;
  const ready = (): Promise<void> => {
    schema ??= (async () => {
      for (const statement of SCHEMA) {
        await driver.run(statement);
      }
    })();
    return schema;
  };
  /** The adapter's one `catch`: a failing database becomes a value, as in the IndexedDB provider. */
  const guarded = async <T>(
    signal: AbortSignal,
    work: () => Promise<TStorageResult<T>>
  ): Promise<TStorageResult<T>> => {
    if (signal.aborted) {
      return ABORTED;
    }
    try {
      await ready();
      return await work();
    } catch {
      return err({ kind: 'unavailable' as const });
    }
  };
  const current = async (
    tx: ISqlStatements,
    path: TStoragePath
  ): Promise<IStorageObjectStat | null> => {
    const [row] = await tx.all(
      'SELECT path, rev, size, modified_at FROM storage_objects WHERE namespace = ? AND path = ?',
      [namespace, path]
    );
    return isNil(row) ? null : statOf(row);
  };
  const nextRevision = async (tx: ISqlStatements): Promise<TStorageRev> => {
    await tx.run(
      `INSERT INTO storage_revisions (namespace, last) VALUES (?, 1)
       ON CONFLICT (namespace) DO UPDATE SET last = last + 1`,
      [namespace]
    );
    const [row] = await tx.all('SELECT last FROM storage_revisions WHERE namespace = ?', [
      namespace,
    ]);
    return String(isNil(row) ? 0 : (numberOf(row, 'last') ?? 0)) as TStorageRev;
  };

  return {
    kind: 'sql',
    capabilities: LOCAL_CAPABILITIES,
    stat: (path, signal) => guarded(signal, async () => ok(await current(driver, path))),
    read: (path, signal) =>
      guarded(signal, async () => {
        const [row] = await driver.all(
          'SELECT path, bytes, rev, size, modified_at FROM storage_objects WHERE namespace = ? AND path = ?',
          [namespace, path]
        );
        const stat = isNil(row) ? null : statOf(row);
        const bytes = isNil(row) ? null : bytesOf(row, 'bytes');
        return ok(isNil(stat) || isNil(bytes) ? null : { bytes, stat });
      }),
    write: (path, bytes, precondition, signal) =>
      guarded<TWriteResult>(signal, () =>
        driver.transaction<TStorageResult<TWriteResult>>(async tx => {
          const before = await current(tx, path);
          if (!isPreconditionMet(precondition, before)) {
            return ok({ kind: 'conflict', current: before });
          }
          const stat: IStorageObjectStat = {
            path,
            rev: await nextRevision(tx),
            size: bytes.length,
            modifiedAt: now(),
          };
          await tx.run(
            `INSERT INTO storage_objects (namespace, path, bytes, rev, size, modified_at)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT (namespace, path) DO UPDATE SET
               bytes = excluded.bytes, rev = excluded.rev, size = excluded.size,
               modified_at = excluded.modified_at`,
            [namespace, path, bytes.slice(), stat.rev, stat.size, stat.modifiedAt]
          );
          return ok({ kind: 'ok', stat });
        })
      ),
    remove: (path, precondition, signal) =>
      guarded<TRemoveResult>(signal, () =>
        driver.transaction<TStorageResult<TRemoveResult>>(async tx => {
          const before = await current(tx, path);
          if (isNil(before)) {
            return err({ kind: 'not-found' });
          }
          if (!isPreconditionMet(precondition, before)) {
            return ok({ kind: 'conflict', current: before });
          }
          await tx.run('DELETE FROM storage_objects WHERE namespace = ? AND path = ?', [
            namespace,
            path,
          ]);
          return ok({ kind: 'removed' });
        })
      ),
    list: (directory, signal) =>
      guarded(signal, async () => {
        const rows = await driver.all(
          'SELECT path, rev, size, modified_at FROM storage_objects WHERE namespace = ? ORDER BY path',
          [namespace]
        );
        return ok(
          rows.flatMap(row => {
            const stat = statOf(row);
            return isNil(stat) || !isDirectChild(stat.path, directory) ? [] : [stat];
          })
        );
      }),
  };
}
