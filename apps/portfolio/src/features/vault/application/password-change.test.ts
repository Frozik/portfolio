import { storagePath } from '@frozik/cloud-storage/core/storage-path';
import { assert } from '@frozik/utils/assert/assert';
import { err } from '@frozik/utils/result/result';
import { decodeHeader } from '@frozik/vault/format/header';
import { when } from 'mobx';

import { CLOUD_PUSH_DEBOUNCE_MS } from './CloudLink';
import {
  TEST_FOLDER,
  TEST_PASSWORD,
  aCloud,
  aDevice,
  linkedToWebDav,
  openedFromTheCloud,
} from './fake-device.test-helper';
import type { VaultFeatureStore } from './VaultFeatureStore';
import type { VaultSession } from './VaultSession';

const NEW_PASSWORD = 'a brand new master password';
const SIGNAL = new AbortController().signal;
/** Generous: it only waits for the sync cycle to finish. */
const EVENT_WAIT_MS = 10_000;

async function unlockedAgain(
  device: ReturnType<typeof aDevice>,
  vaultKey: string,
  password: string
): Promise<VaultFeatureStore> {
  const store = device.startStore();
  store.choose(vaultKey);
  store.unlock(password);
  await when(() => store.session !== null || store.lifecycle.kind === 'locked');
  await when(() => store.lifecycle.kind !== 'unlocking');
  return store;
}

async function settled(store: VaultFeatureStore): Promise<void> {
  await when(() => store.session?.local.state.phase.kind === 'idle');
}

async function confirmedRecoveryKey(
  store: VaultFeatureStore,
  session: VaultSession
): Promise<void> {
  const flow = store.recoveryKeyOf(session, () =>
    Promise.resolve({ name: 'kit.pdf', mime: 'application/pdf', bytes: Uint8Array.of(1) })
  );
  flow.start();
  const { step } = flow;
  assert(step.kind === 'shown');
  flow.toConfirmation();
  flow.setLastGroup(step.formatted.split('-').at(-1) ?? '');
  flow.setPassword(TEST_PASSWORD);
  await flow.confirm();
}

describe('changing the master password', () => {
  it('opens the vault with the new password from then on, never with the old one', async () => {
    const device = aDevice();
    const store = device.startStore();
    store.create('Mine', TEST_PASSWORD);
    await when(() => store.session !== null);
    const { session } = store;
    assert(session !== null);

    expect(
      await session.keys.change({ kind: 'password', password: 'not the password' }, NEW_PASSWORD)
    ).toBe('wrong-password');
    expect(
      await session.keys.change({ kind: 'password', password: TEST_PASSWORD }, NEW_PASSWORD)
    ).toBeNull();
    await settled(store);
    store.dispose();

    const withOld = await unlockedAgain(device, session.vaultKey, TEST_PASSWORD);
    expect(withOld.lifecycle).toMatchObject({ kind: 'locked', failure: 'wrong-password' });
    withOld.dispose();
    const withNew = await unlockedAgain(device, session.vaultKey, NEW_PASSWORD);
    expect(withNew.lifecycle.kind).toBe('unlocked');
  });

  it('reaches another device through the cloud, which says so and opens with the new one', async () => {
    const cloud = aCloud();
    const first = await linkedToWebDav(aDevice({ cloud }));
    const secondDevice = aDevice({ cloud, seed: 8 });
    const second = secondDevice.startStore();
    second.cloud.openWebDavForm();
    second.cloud.webDavForm?.setEndpoint(TEST_FOLDER);
    second.cloud.webDavForm?.setUsername('me');
    second.cloud.webDavForm?.setPassword('app-password');
    await second.cloud.webDavForm?.runCheck();
    const vaultKey = (await second.cloud.openFromWebDav(storagePath('Family.pwv'))) ?? '';
    second.choose(vaultKey);
    second.unlock(TEST_PASSWORD);
    await when(() => second.session?.cloud.status.kind === 'synced');

    expect(
      await first.store.session?.keys.change(
        { kind: 'password', password: TEST_PASSWORD },
        NEW_PASSWORD
      )
    ).toBeNull();
    first.device.time.advance(CLOUD_PUSH_DEBOUNCE_MS);
    await when(() => first.store.session?.cloud.status.kind === 'synced');
    secondDevice.page.setHidden(true);
    secondDevice.page.setHidden(false);
    await when(() => second.session?.keys.changedElsewhere === true);
    await settled(second);
    second.dispose();

    const reopened = await unlockedAgain(secondDevice, vaultKey, NEW_PASSWORD);
    expect(reopened.lifecycle.kind).toBe('unlocked');
  });

  it('is no rollback for a cloud that missed it: the cloud gets the new slots later', async () => {
    const { device, store } = await linkedToWebDav();
    const cloudStore = device.cloud.storeAt(TEST_FOLDER);
    assert(cloudStore !== undefined);
    const unreachable = (['stat', 'read', 'write'] as const).map(method =>
      vi.spyOn(cloudStore, method).mockResolvedValue(err({ kind: 'offline' }))
    );
    const vaultKey = store.session?.vaultKey ?? '';

    expect(
      await store.session?.keys.change({ kind: 'password', password: TEST_PASSWORD }, NEW_PASSWORD)
    ).toBeNull();
    await settled(store);
    store.dispose();
    unreachable.forEach(spy => spy.mockRestore());
    const reopened = await unlockedAgain(device, vaultKey, NEW_PASSWORD);
    const cloudEpoch = async (): Promise<number | null> => {
      const read = await cloudStore.read(storagePath('Family.pwv'), SIGNAL);
      const header = read.ok && read.value !== null ? decodeHeader(read.value.bytes) : null;
      return header?.ok === true ? header.value.header.keyslotsEpoch : null;
    };

    await vi.waitFor(async () => expect(await cloudEpoch()).toBe(1), { timeout: EVENT_WAIT_MS });
    expect(reopened.session?.cloud.status.kind).not.toBe('stopped');
  });

  it('keeps both changes when two devices change the slots before they sync', async () => {
    const cloud = aCloud();
    const first = await linkedToWebDav(aDevice({ cloud }));
    const secondDevice = aDevice({ cloud, seed: 8 });
    const second = await openedFromTheCloud(secondDevice);

    expect(
      await second.session?.keys.change({ kind: 'password', password: TEST_PASSWORD }, NEW_PASSWORD)
    ).toBeNull();
    const session = first.store.session;
    assert(session !== null);
    await confirmedRecoveryKey(first.store, session);
    first.device.time.advance(CLOUD_PUSH_DEBOUNCE_MS);
    await when(() => session.cloud.status.kind === 'synced');
    secondDevice.time.advance(CLOUD_PUSH_DEBOUNCE_MS);
    await when(() => second.session?.keys.changedElsewhere === true);
    await when(() => second.session?.cloud.status.kind === 'synced');
    first.device.page.setHidden(true);
    first.device.page.setHidden(false);
    await when(() => session.keys.changedElsewhere);
    await when(() => session.cloud.status.kind === 'synced');

    const kinds = (keys: { readonly keyslots: readonly { readonly kind: string }[] }) =>
      keys.keyslots.map(slot => slot.kind).sort();
    expect(kinds(session.keys.current)).toEqual(['password', 'recovery']);
    expect(session.keys.current.keyslots).toEqual(second.session?.keys.current.keyslots);
    expect(session.keys.current.keyslotsEpoch).toBe(second.session?.keys.current.keyslotsEpoch);
  });

  it('never takes back a leaked password from a replayed file between two changes', async () => {
    const { device, store } = await linkedToWebDav();
    const session = store.session;
    assert(session !== null);
    const cloudStore = device.cloud.storeAt(TEST_FOLDER);
    assert(cloudStore !== undefined);
    const path = storagePath('Family.pwv');
    const leaked = 'the leaked middle password';
    const synced = async (): Promise<void> => {
      device.time.advance(CLOUD_PUSH_DEBOUNCE_MS);
      await when(() => session.cloud.status.kind === 'synced');
      await when(() => session.local.state.phase.kind === 'idle');
    };

    await session.keys.change({ kind: 'password', password: TEST_PASSWORD }, leaked);
    device.time.advance(CLOUD_PUSH_DEBOUNCE_MS);
    await synced();
    const middle = await cloudStore.read(path, SIGNAL);
    assert(middle.ok && middle.value !== null);
    await session.keys.change({ kind: 'password', password: leaked }, NEW_PASSWORD);
    await synced();
    await cloudStore.write(path, middle.value.bytes, { kind: 'overwrite' }, SIGNAL);
    device.page.setHidden(true);
    device.page.setHidden(false);
    await when(() => store.lifecycle.kind !== 'unlocked');

    expect(store.lifecycle).toMatchObject({ reason: 'rollback-security' });
    expect(session.keys.changedElsewhere).toBe(false);
    store.dispose();
    const withLeaked = await unlockedAgain(device, session.vaultKey, leaked);
    expect(withLeaked.lifecycle).toMatchObject({ kind: 'locked', failure: 'wrong-password' });
    withLeaked.dispose();
    expect((await unlockedAgain(device, session.vaultKey, NEW_PASSWORD)).lifecycle.kind).toBe(
      'unlocked'
    );
  });
});
