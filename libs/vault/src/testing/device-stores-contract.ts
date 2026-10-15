import { assert } from '@frozik/utils/assert/assert';
import type { Milliseconds } from '@frozik/utils/date/types';
import { isNil } from 'lodash-es';

import type { IDeviceStores, IKnownVault, ISyncState } from '../persistence/ports';
import type { IRandom } from '../ports/random';
import { createSeededRandom } from './seeded-random';

/** Opens the stores of one device; every call sees what the earlier ones wrote. */
export type TOpenDeviceStores = (random: IRandom) => IDeviceStores;

const VAULT: IKnownVault = {
  vaultKey: 'a1b2',
  name: 'Personal',
  description: '',
  lastOpenedAt: 1_760_000_000_000 as Milliseconds,
  unsyncedChanges: false,
};

const SEEN: ISyncState = {
  maxSeenRevision: 9,
  maxSeenKeyslotsEpoch: 3,
  cloudKeyslotsEpoch: 2,
  hashAtMaxSeen: 'at-9',
  retiredKeyIds: ['old-key'],
  keyId: 'ff00',
  lastSyncedRev: '12',
  lastHlc: { wallMs: 5, counter: 0, node: 'n' },
};

/**
 * One suite every device storage passes: the same promises about
 * vaults, sync state, sealed records and snapshots, whatever keeps the bytes.
 */
export function describeDeviceStoresContract(
  name: string,
  newDevice: () => TOpenDeviceStores
): void {
  const freshStores = (): IDeviceStores => newDevice()(createSeededRandom(1));

  describe(`${name} — device stores contract`, () => {
    it('remember the vaults of this device and forget one on request', async () => {
      const stores = freshStores();

      await stores.registry.put(VAULT);
      await stores.registry.put({ ...VAULT, vaultKey: 'c3d4', name: 'Work' });
      await stores.registry.remove('c3d4');

      expect(await stores.registry.list()).toEqual({ ok: true, value: [VAULT] });
    });

    it('give this device one id for good', async () => {
      const open = newDevice();
      const first = await open(createSeededRandom(1)).syncState.deviceId();
      const again = await open(createSeededRandom(999)).syncState.deviceId();

      expect(first.ok).toBe(true);
      expect(again).toEqual(first);
    });

    it('keep the sync state of each vault', async () => {
      const stores = freshStores();

      await stores.syncState.put(VAULT.vaultKey, SEEN);

      expect(await stores.syncState.get(VAULT.vaultKey)).toEqual({ ok: true, value: SEEN });
      expect(await stores.syncState.get('other')).toEqual({ ok: true, value: null });
    });

    it('never lower what guards against rollback, whoever saves last', async () => {
      const stores = freshStores();

      await stores.syncState.put(VAULT.vaultKey, SEEN);
      await stores.syncState.put(VAULT.vaultKey, {
        ...SEEN,
        maxSeenRevision: 7,
        cloudKeyslotsEpoch: 1,
        hashAtMaxSeen: 'at-7',
        retiredKeyIds: [],
        lastSyncedRev: '13',
      });

      expect(await stores.syncState.get(VAULT.vaultKey)).toEqual({
        ok: true,
        value: { ...SEEN, lastSyncedRev: '13' },
      });
    });

    it('forget the sync state of a vault on request', async () => {
      const stores = freshStores();

      await stores.syncState.put(VAULT.vaultKey, SEEN);
      await stores.syncState.remove(VAULT.vaultKey);

      expect(await stores.syncState.get(VAULT.vaultKey)).toEqual({ ok: true, value: null });
    });

    it('keep sealed records per vault and per kind apart', async () => {
      const stores = freshStores();
      await stores.drafts.put(VAULT.vaultKey, 'card-1', Uint8Array.of(1));
      await stores.drafts.put(VAULT.vaultKey, 'card-2', Uint8Array.of(2));
      await stores.drafts.put('other-vault', 'card-1', Uint8Array.of(3));
      await stores.usage.put(VAULT.vaultKey, 'usage', Uint8Array.of(4));

      await stores.drafts.delete(VAULT.vaultKey, 'card-2');

      expect(await stores.drafts.keys(VAULT.vaultKey)).toEqual({ ok: true, value: ['card-1'] });
      expect(await stores.drafts.get(VAULT.vaultKey, 'card-1')).toEqual({
        ok: true,
        value: Uint8Array.of(1),
      });
      expect(await stores.deviceConfig.get(VAULT.vaultKey, 'usage')).toEqual({
        ok: true,
        value: null,
      });
    });

    it('keep as many newest snapshots of a vault as asked, newest first', async () => {
      const stores = freshStores();
      for (let index = 1; index <= 7; index += 1) {
        await stores.snapshots.add(
          VAULT.vaultKey,
          { takenAt: index as Milliseconds, reason: 'periodic', file: Uint8Array.of(index) },
          5
        );
      }
      await stores.snapshots.add(
        'other-vault',
        { takenAt: 99 as Milliseconds, reason: 'periodic', file: Uint8Array.of(99) },
        5
      );

      const listed = await stores.snapshots.list(VAULT.vaultKey);

      expect(listed.ok && listed.value.map(snapshot => snapshot.takenAt)).toEqual([7, 6, 5, 4, 3]);
    });

    it('list snapshots with the later added first, even when its clock was behind', async () => {
      const stores = freshStores();
      const added = [
        { takenAt: 5, reason: 'periodic' },
        { takenAt: 5, reason: 'before-sync' },
        { takenAt: 3, reason: 'before-restore' },
      ] as const;
      for (const { takenAt, reason } of added) {
        await stores.snapshots.add(
          VAULT.vaultKey,
          { takenAt: takenAt as Milliseconds, reason, file: Uint8Array.of(1) },
          5
        );
      }

      const listed = await stores.snapshots.list(VAULT.vaultKey);

      expect(listed.ok && listed.value.map(snapshot => snapshot.reason)).toEqual([
        'before-restore',
        'before-sync',
        'periodic',
      ]);
    });

    it('list snapshots without their files and read one file by its id', async () => {
      const stores = freshStores();
      await stores.snapshots.add(
        VAULT.vaultKey,
        { takenAt: 5 as Milliseconds, reason: 'before-sync', file: Uint8Array.of(1, 2, 3) },
        5
      );

      const listed = await stores.snapshots.list(VAULT.vaultKey);
      assert(listed.ok);
      const [entry] = listed.value;
      assert(!isNil(entry));

      expect(entry).toEqual({ id: entry.id, takenAt: 5, reason: 'before-sync', size: 3 });
      expect(await stores.snapshots.read(VAULT.vaultKey, entry.id)).toEqual({
        ok: true,
        value: Uint8Array.of(1, 2, 3),
      });
      expect(await stores.snapshots.read('other-vault', entry.id)).toEqual({
        ok: true,
        value: null,
      });
    });

    it('forget everything on this device on request', async () => {
      const stores = freshStores();
      await stores.registry.put(VAULT);
      await stores.drafts.put(VAULT.vaultKey, 'card-1', Uint8Array.of(1));

      expect(await stores.forgetDevice()).toEqual({ ok: true, value: undefined });
      expect(await stores.registry.list()).toEqual({ ok: true, value: [] });
      expect(await stores.drafts.keys(VAULT.vaultKey)).toEqual({ ok: true, value: [] });
    });
  });
}
