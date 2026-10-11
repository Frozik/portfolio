import { isNil, uniq } from 'lodash-es';
import { z } from 'zod';

import { randomUuid } from '../../model/ids';
import type { IRandom } from '../../ports/random';
import type { ISyncState, ISyncStateStore } from '../ports';
import type { TRunInDatabase } from './device-database';

const DEVICE_ID_KEY = 'device-id';

const SYNC_STATE_SCHEMA = z.object({
  maxSeenRevision: z.int().nonnegative(),
  maxSeenKeyslotsEpoch: z.int().nonnegative(),
  cloudKeyslotsEpoch: z.int().nonnegative().optional(),
  retiredKeyIds: z.array(z.string()).optional(),
  hashAtMaxSeen: z.string().nullable(),
  keyId: z.string(),
  lastSyncedRev: z.string().nullable(),
  lastHlc: z
    .object({ wallMs: z.int().nonnegative(), counter: z.int().nonnegative(), node: z.string() })
    .nullable(),
});

/**
 * What guards against rollback only ever rises: two tabs
 * save the same record, and the one that saw less must not lower the bar.
 */
function raised(stored: z.infer<typeof SYNC_STATE_SCHEMA>, next: ISyncState): ISyncState {
  const newerRevision = next.maxSeenRevision >= stored.maxSeenRevision;
  return {
    ...next,
    maxSeenRevision: Math.max(stored.maxSeenRevision, next.maxSeenRevision),
    maxSeenKeyslotsEpoch: Math.max(stored.maxSeenKeyslotsEpoch, next.maxSeenKeyslotsEpoch),
    cloudKeyslotsEpoch: Math.max(stored.cloudKeyslotsEpoch ?? 0, next.cloudKeyslotsEpoch),
    hashAtMaxSeen: newerRevision ? next.hashAtMaxSeen : stored.hashAtMaxSeen,
    retiredKeyIds: uniq([...(stored.retiredKeyIds ?? []), ...next.retiredKeyIds]),
  };
}

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
      run(async database => {
        const parsed = SYNC_STATE_SCHEMA.safeParse(await database.get('sync-state', vaultKey));
        if (!parsed.success) {
          return null;
        }
        const { cloudKeyslotsEpoch, retiredKeyIds, ...state } = parsed.data;
        return {
          ...state,
          cloudKeyslotsEpoch: cloudKeyslotsEpoch ?? state.maxSeenKeyslotsEpoch,
          retiredKeyIds: retiredKeyIds ?? [],
        };
      }),
    put: (vaultKey, state) =>
      run(async database => {
        const transaction = database.transaction('sync-state', 'readwrite');
        const stored = SYNC_STATE_SCHEMA.safeParse(await transaction.store.get(vaultKey));
        await transaction.store.put(stored.success ? raised(stored.data, state) : state, vaultKey);
        await transaction.done;
      }),
    remove: vaultKey => run(async database => void (await database.delete('sync-state', vaultKey))),
  };
}
