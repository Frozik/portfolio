import { deleteDB } from 'idb';

import type { IRandom } from '../../ports/random';
import type { IDeviceStores } from '../ports';
import { createDatabaseRunner, DEVICE_DATABASE_NAME } from './device-database';
import { createSealedRecordStore } from './sealed-record-store';
import { createSnapshotStore } from './snapshot-store';
import { createSyncStateStore } from './sync-state-store';
import { createVaultRegistry } from './vault-registry';

/** Every device store of both clients over one IndexedDB database. */
export function createIndexedDbDeviceStores(
  random: IRandom,
  name: string = DEVICE_DATABASE_NAME
): IDeviceStores {
  const run = createDatabaseRunner(name);
  return {
    registry: createVaultRegistry(run),
    syncState: createSyncStateStore(run, random),
    drafts: createSealedRecordStore(run, 'drafts'),
    usage: createSealedRecordStore(run, 'usage'),
    deviceConfig: createSealedRecordStore(run, 'device-config'),
    snapshots: createSnapshotStore(run),
    forgetDevice: () =>
      run(async () => {
        await run.close();
        await deleteDB(name);
      }),
  };
}
