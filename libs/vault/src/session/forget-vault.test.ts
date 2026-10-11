import 'fake-indexeddb/auto';

import type { Milliseconds } from '@frozik/utils/date/types';

import { createIndexedDbDeviceStores } from '../persistence/indexeddb/device-stores';
import type { IKnownVault, TVaultKey } from '../persistence/ports';
import { createSeededRandom } from '../testing/seeded-random';
import { forgetVaultOnDevice } from './forget-vault';

const HOME = 'home' as TVaultKey;
const WORK = 'work' as TVaultKey;

function known(vaultKey: TVaultKey): IKnownVault {
  return {
    vaultKey,
    name: vaultKey,
    lastOpenedAt: 1 as Milliseconds,
    unsyncedChanges: false,
  };
}

describe('forgetVaultOnDevice', () => {
  it('drops everything the device kept of one vault and nothing of another', async () => {
    const stores = createIndexedDbDeviceStores(createSeededRandom(1), 'pwv:forget-test');
    for (const vaultKey of [HOME, WORK]) {
      await stores.registry.put(known(vaultKey));
      await stores.drafts.put(vaultKey, 'card-draft', Uint8Array.of(1));
      await stores.snapshots.add(vaultKey, { takenAt: 1 as Milliseconds, file: Uint8Array.of(2) });
      await stores.syncState.put(vaultKey, {
        maxSeenRevision: 1,
        maxSeenKeyslotsEpoch: 0,
        cloudKeyslotsEpoch: 0,
        hashAtMaxSeen: null,
        retiredKeyIds: [],
        keyId: 'key',
        lastSyncedRev: null,
        lastHlc: null,
      });
    }

    expect((await forgetVaultOnDevice(stores, HOME)).ok).toBe(true);

    const registry = await stores.registry.list();
    expect(registry.ok && registry.value.map(vault => vault.vaultKey)).toEqual([WORK]);
    expect(await stores.drafts.keys(HOME)).toEqual({ ok: true, value: [] });
    expect(await stores.snapshots.list(HOME)).toEqual({ ok: true, value: [] });
    expect(await stores.syncState.get(HOME)).toEqual({ ok: true, value: null });
    expect((await stores.snapshots.list(WORK)).ok && (await stores.drafts.keys(WORK))).toEqual({
      ok: true,
      value: ['card-draft'],
    });
  });
});
