import { isNil } from 'lodash-es';

import { randomUuid } from '../../model/ids';
import type { IRandom } from '../../ports/random';
import type { ISyncStateStore } from '../ports';
import { readSyncState } from '../stored-records';
import { raisedSyncState } from '../sync-state-ratchet';
import type { TRunInDatabase } from './device-database';

const DEVICE_ID_KEY = 'device-id';

export function createSyncStateStore(run: TRunInDatabase, random: IRandom): ISyncStateStore {
  return {
    deviceId: () =>
      run(async database => {
        const transaction = database.transaction('device', 'readwrite');
        const existing = await transaction.store.get(DEVICE_ID_KEY);
        const deviceId = existing ?? randomUuid(random);
        if (isNil(existing)) {
          await transaction.store.put(deviceId, DEVICE_ID_KEY);
        }
        await transaction.done;
        return deviceId;
      }),
    get: vaultKey =>
      run(async database => readSyncState(await database.get('sync-state', vaultKey))),
    put: (vaultKey, state) =>
      run(async database => {
        const transaction = database.transaction('sync-state', 'readwrite');
        const stored = readSyncState(await transaction.store.get(vaultKey));
        await transaction.store.put(
          isNil(stored) ? state : raisedSyncState(stored, state),
          vaultKey
        );
        await transaction.done;
      }),
    remove: vaultKey => run(async database => void (await database.delete('sync-state', vaultKey))),
  };
}
