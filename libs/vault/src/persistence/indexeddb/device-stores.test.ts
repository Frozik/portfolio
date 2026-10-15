import 'fake-indexeddb/auto';

import { assert } from '@frozik/utils/assert/assert';
import type { Milliseconds } from '@frozik/utils/date/types';
import { openDB } from 'idb';
import { isNil, omit } from 'lodash-es';

import { describeDeviceStoresContract } from '../../testing/device-stores-contract';
import { createSeededRandom } from '../../testing/seeded-random';
import { openDeviceDatabase } from './device-database';
import { createIndexedDbDeviceStores } from './device-stores';

let databases = 0;

function freshStores(): ReturnType<typeof createIndexedDbDeviceStores> & { readonly name: string } {
  databases += 1;
  const name = `pwv:test-device:${databases}`;
  return Object.assign(createIndexedDbDeviceStores(createSeededRandom(databases), name), { name });
}

const vault = {
  vaultKey: 'a1b2',
  name: 'Personal',
  description: '',
  lastOpenedAt: 1_760_000_000_000 as Milliseconds,
  unsyncedChanges: false,
} as const;

describeDeviceStoresContract('IndexedDB', () => {
  databases += 1;
  const name = `pwv:test-device:${databases}`;
  return random => createIndexedDbDeviceStores(random, name);
});

describe('IndexedDB device stores', () => {
  it('keep only a vault’s name, description and dates in the open, whatever else a caller hands over', async () => {
    const stores = freshStores();

    const handedOver = { ...vault, url: 'https://dav.example/jane/' };

    await stores.registry.put(handedOver);
    const database = await openDeviceDatabase(stores.name);

    expect(await database.get('registry', vault.vaultKey)).toEqual(vault);
  });

  it('read a vault listed before descriptions as one without a description', async () => {
    const stores = freshStores();
    const database = await openDeviceDatabase(stores.name);
    await database.put('registry', omit(vault, 'description'), vault.vaultKey);
    database.close();

    expect(await stores.registry.list()).toEqual({ ok: true, value: [vault] });
  });

  it('skip a registry entry this version cannot read instead of failing the list', async () => {
    const stores = freshStores();
    await stores.registry.put(vault);
    const database = await openDeviceDatabase(stores.name);
    await database.put('registry', { vaultKey: 'future', shape: 'unknown' }, 'future');
    database.close();

    expect(await stores.registry.list()).toEqual({ ok: true, value: [vault] });
  });

  it('read a sync state saved before the cloud epoch and retired keys as one where both are the local ones', async () => {
    const stores = freshStores();
    const legacy = {
      maxSeenRevision: 4,
      maxSeenKeyslotsEpoch: 2,
      hashAtMaxSeen: 'at-4',
      keyId: 'ff00',
      lastSyncedRev: null,
      lastHlc: null,
    };
    const database = await openDeviceDatabase(stores.name);
    await database.put('sync-state', legacy, vault.vaultKey);
    database.close();

    await stores.syncState.put(vault.vaultKey, {
      ...legacy,
      maxSeenRevision: 3,
      maxSeenKeyslotsEpoch: 1,
      cloudKeyslotsEpoch: 1,
      retiredKeyIds: [],
    });

    expect(await stores.syncState.get(vault.vaultKey)).toEqual({
      ok: true,
      value: { ...legacy, cloudKeyslotsEpoch: 2, retiredKeyIds: [] },
    });
  });

  it('drop the files of the snapshots it no longer keeps', async () => {
    const stores = freshStores();
    for (let index = 1; index <= 3; index += 1) {
      await stores.snapshots.add(
        vault.vaultKey,
        { takenAt: index as Milliseconds, reason: 'periodic', file: Uint8Array.of(index) },
        1
      );
    }
    const database = await openDeviceDatabase(stores.name);

    expect(await database.count('snapshot-files')).toBe(1);
    database.close();
  });

  it('carry snapshots kept by an earlier version over, files apart', async () => {
    const name = `pwv:test-legacy:${databases}`;
    databases += 1;
    const legacy = await openDB(name, 1, {
      upgrade(database) {
        database
          .createObjectStore('snapshots', { autoIncrement: true })
          .createIndex('vault', 'vaultKey');
      },
    });
    await legacy.add('snapshots', { vaultKey: 'a1b2', takenAt: 4, file: Uint8Array.of(9, 9) });
    legacy.close();
    const stores = createIndexedDbDeviceStores(createSeededRandom(databases), name);

    const listed = await stores.snapshots.list('a1b2');
    assert(listed.ok);
    const [entry] = listed.value;
    assert(!isNil(entry));

    expect(entry).toMatchObject({ takenAt: 4, reason: 'before-sync', size: 2 });
    expect(await stores.snapshots.read('a1b2', entry.id)).toEqual({
      ok: true,
      value: Uint8Array.of(9, 9),
    });
  });
});
