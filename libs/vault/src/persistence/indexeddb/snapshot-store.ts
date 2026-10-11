import type { Milliseconds } from '@frozik/utils/date/types';

import type { ISnapshotStore } from '../ports';
import type { TRunInDatabase } from './device-database';

/** The last ten local versions per vault. */
export const MAX_SNAPSHOTS = 10;

export function createSnapshotStore(run: TRunInDatabase): ISnapshotStore {
  return {
    add: (vaultKey, { takenAt, file }) =>
      run(async database => {
        const transaction = database.transaction('snapshots', 'readwrite');
        await transaction.store.add({ vaultKey, takenAt, file });
        const keys = await transaction.store.index('vault').getAllKeys(vaultKey);
        for (const key of keys.slice(0, Math.max(0, keys.length - MAX_SNAPSHOTS))) {
          await transaction.store.delete(key);
        }
        await transaction.done;
      }),
    list: vaultKey =>
      run(async database =>
        (await database.getAllFromIndex('snapshots', 'vault', vaultKey))
          .map(snapshot => ({ takenAt: snapshot.takenAt as Milliseconds, file: snapshot.file }))
          .reverse()
      ),
    clear: vaultKey =>
      run(async database => {
        const transaction = database.transaction('snapshots', 'readwrite');
        for (const key of await transaction.store.index('vault').getAllKeys(vaultKey)) {
          await transaction.store.delete(key);
        }
        await transaction.done;
      }),
  };
}
