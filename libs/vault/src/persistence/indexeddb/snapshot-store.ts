import type { Milliseconds } from '@frozik/utils/date/types';

import type { ISnapshotEntry, ISnapshotStore, TSnapshotReason } from '../ports';
import type { TRunInDatabase } from './device-database';

const REASONS: ReadonlySet<string> = new Set<TSnapshotReason>([
  'before-sync',
  'periodic',
  'before-restore',
]);

function reasonOf(stored: string | undefined): TSnapshotReason {
  return REASONS.has(stored ?? '') ? (stored as TSnapshotReason) : 'before-sync';
}

export function createSnapshotStore(run: TRunInDatabase): ISnapshotStore {
  return {
    add: (vaultKey, { takenAt, reason, file }, keep) =>
      run(async database => {
        const transaction = database.transaction(['snapshots', 'snapshot-files'], 'readwrite');
        const snapshots = transaction.objectStore('snapshots');
        const files = transaction.objectStore('snapshot-files');
        const id = await snapshots.add({ vaultKey, takenAt, reason, size: file.byteLength });
        await files.put(file, id);
        const ids = await snapshots.index('vault').getAllKeys(vaultKey);
        for (const stale of ids.slice(0, Math.max(0, ids.length - keep))) {
          await snapshots.delete(stale);
          await files.delete(stale);
        }
        await transaction.done;
      }),
    list: vaultKey =>
      run(async database => {
        const transaction = database.transaction('snapshots');
        const index = transaction.store.index('vault');
        const [ids, values] = await Promise.all([
          index.getAllKeys(vaultKey),
          index.getAll(vaultKey),
        ]);
        return values
          .map((value, position): ISnapshotEntry => ({
            id: ids[position] ?? 0,
            takenAt: value.takenAt as Milliseconds,
            reason: reasonOf(value.reason),
            size: value.size ?? value.file?.byteLength ?? 0,
          }))
          .reverse();
      }),
    read: (vaultKey, id) =>
      run(async database => {
        const transaction = database.transaction(['snapshots', 'snapshot-files']);
        const entry = await transaction.objectStore('snapshots').get(id);
        if (entry?.vaultKey !== vaultKey) {
          return null;
        }
        return (await transaction.objectStore('snapshot-files').get(id)) ?? null;
      }),
    clear: vaultKey =>
      run(async database => {
        const transaction = database.transaction(['snapshots', 'snapshot-files'], 'readwrite');
        const snapshots = transaction.objectStore('snapshots');
        for (const id of await snapshots.index('vault').getAllKeys(vaultKey)) {
          await snapshots.delete(id);
          await transaction.objectStore('snapshot-files').delete(id);
        }
        await transaction.done;
      }),
  };
}
