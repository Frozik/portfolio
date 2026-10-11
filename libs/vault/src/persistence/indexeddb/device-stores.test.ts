import 'fake-indexeddb/auto';

import type { Milliseconds } from '@frozik/utils/date/types';

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
  lastOpenedAt: 1_760_000_000_000 as Milliseconds,
  unsyncedChanges: false,
} as const;

describe('device stores', () => {
  it('remember the vaults of this device and forget one on request', async () => {
    const stores = freshStores();

    await stores.registry.put(vault);
    await stores.registry.put({
      ...vault,
      vaultKey: 'c3d4',
      name: 'Work',
    });
    await stores.registry.remove('c3d4');

    expect(await stores.registry.list()).toEqual({ ok: true, value: [vault] });
  });

  it('keep only a vault’s name and dates in the open, whatever else a caller hands over', async () => {
    const stores = freshStores();

    const handedOver = { ...vault, url: 'https://dav.example/jane/' };

    await stores.registry.put(handedOver);
    const database = await openDeviceDatabase(stores.name);

    expect(await database.get('registry', vault.vaultKey)).toEqual(vault);
  });

  it('skip a registry entry this version cannot read instead of failing the list', async () => {
    const stores = freshStores();
    await stores.registry.put(vault);
    const database = await openDeviceDatabase(stores.name);
    await database.put('registry', { vaultKey: 'future', shape: 'unknown' }, 'future');
    database.close();

    expect(await stores.registry.list()).toEqual({ ok: true, value: [vault] });
  });

  it('give this device one id for good', async () => {
    const stores = freshStores();
    const first = await stores.syncState.deviceId();
    const again = await createIndexedDbDeviceStores(
      createSeededRandom(999),
      stores.name
    ).syncState.deviceId();

    expect(first.ok).toBe(true);
    expect(again).toEqual(first);
  });

  it('keep the sync state of each vault', async () => {
    const stores = freshStores();
    const state = {
      maxSeenRevision: 7,
      maxSeenKeyslotsEpoch: 2,
      cloudKeyslotsEpoch: 1,
      hashAtMaxSeen: 'ab12',
      retiredKeyIds: ['old-key'],
      keyId: 'ff00',
      lastSyncedRev: '12',
      lastHlc: { wallMs: 5, counter: 0, node: 'n' },
    };

    await stores.syncState.put(vault.vaultKey, state);

    expect(await stores.syncState.get(vault.vaultKey)).toEqual({ ok: true, value: state });
    expect(await stores.syncState.get('other')).toEqual({ ok: true, value: null });
  });

  it('never lower what guards against rollback, whoever saves last', async () => {
    const stores = freshStores();
    const seen = {
      maxSeenRevision: 9,
      maxSeenKeyslotsEpoch: 3,
      cloudKeyslotsEpoch: 3,
      hashAtMaxSeen: 'at-9',
      retiredKeyIds: ['k1'],
      keyId: 'ff00',
      lastSyncedRev: '12',
      lastHlc: null,
    };

    await stores.syncState.put(vault.vaultKey, seen);
    await stores.syncState.put(vault.vaultKey, {
      ...seen,
      maxSeenRevision: 7,
      cloudKeyslotsEpoch: 1,
      hashAtMaxSeen: 'at-7',
      retiredKeyIds: [],
      lastSyncedRev: '13',
    });

    expect(await stores.syncState.get(vault.vaultKey)).toEqual({
      ok: true,
      value: { ...seen, lastSyncedRev: '13' },
    });
  });

  it('keep sealed records per vault and per kind apart', async () => {
    const stores = freshStores();
    await stores.drafts.put(vault.vaultKey, 'card-1', Uint8Array.of(1));
    await stores.drafts.put(vault.vaultKey, 'card-2', Uint8Array.of(2));
    await stores.drafts.put('other-vault', 'card-1', Uint8Array.of(3));
    await stores.usage.put(vault.vaultKey, 'usage', Uint8Array.of(4));

    await stores.drafts.delete(vault.vaultKey, 'card-2');

    expect(await stores.drafts.keys(vault.vaultKey)).toEqual({ ok: true, value: ['card-1'] });
    expect(await stores.drafts.get(vault.vaultKey, 'card-1')).toEqual({
      ok: true,
      value: Uint8Array.of(1),
    });
    expect(await stores.deviceConfig.get(vault.vaultKey, 'usage')).toEqual({
      ok: true,
      value: null,
    });
  });

  it('keep the ten newest snapshots of a vault, newest first', async () => {
    const stores = freshStores();
    for (let index = 1; index <= 12; index += 1) {
      await stores.snapshots.add(vault.vaultKey, {
        takenAt: index as Milliseconds,
        file: Uint8Array.of(index),
      });
    }
    await stores.snapshots.add('other-vault', {
      takenAt: 99 as Milliseconds,
      file: Uint8Array.of(99),
    });

    const listed = await stores.snapshots.list(vault.vaultKey);

    expect(listed.ok && listed.value.map(snapshot => snapshot.takenAt)).toEqual([
      12, 11, 10, 9, 8, 7, 6, 5, 4, 3,
    ]);
  });

  it('forget everything on this device on request', async () => {
    const stores = freshStores();
    await stores.registry.put(vault);
    await stores.drafts.put(vault.vaultKey, 'card-1', Uint8Array.of(1));

    expect(await stores.forgetDevice()).toEqual({ ok: true, value: undefined });
    expect(await stores.registry.list()).toEqual({ ok: true, value: [] });
    expect(await stores.drafts.keys(vault.vaultKey)).toEqual({ ok: true, value: [] });
  });
});
