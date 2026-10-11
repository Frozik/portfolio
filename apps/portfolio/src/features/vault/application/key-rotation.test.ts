import { storagePath } from '@frozik/cloud-storage/core/storage-path';
import { assert } from '@frozik/utils/assert/assert';
import type { Milliseconds } from '@frozik/utils/date/types';
import { toHex } from '@frozik/vault/crypto/bytes';
import { decodeHeader } from '@frozik/vault/format/header';
import { aCard } from '@frozik/vault/testing/builders';
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

const SIGNAL = new AbortController().signal;
const IDLE_LOCK_MS = 15 * 60 * 1000;

async function unlockedAgain(
  device: ReturnType<typeof aDevice>,
  vaultKey: string
): Promise<VaultFeatureStore> {
  const store = device.startStore();
  store.choose(vaultKey);
  store.unlock(TEST_PASSWORD);
  await when(() => store.lifecycle.kind !== 'unlocking');
  return store;
}

async function cloudKeyId(device: ReturnType<typeof aDevice>): Promise<string | null> {
  const read = await device.cloud.storeAt(TEST_FOLDER)?.read(storagePath('Family.pwv'), SIGNAL);
  const header = read?.ok === true && read.value !== null ? decodeHeader(read.value.bytes) : null;
  return header?.ok === true ? toHex(header.value.header.keyId) : null;
}

describe('rotating the vault key', () => {
  it('locks the vault, which then opens under a new key, still linked, with this device’s settings', async () => {
    const { device, store } = await linkedToWebDav();
    const session = store.session;
    assert(session !== null);
    session.deviceSettings.update({
      lock: { idle: IDLE_LOCK_MS as Milliseconds, hidden: null },
    });
    await session.deviceSettings.saved();
    const oldKeyId = toHex(session.keys.current.keyId);

    await session.rotation.rotate(TEST_PASSWORD);
    await when(() => store.lifecycle.kind !== 'unlocked');
    store.dispose();

    expect(await cloudKeyId(device)).not.toBe(oldKeyId);
    const reopened = await unlockedAgain(device, session.vaultKey);
    await when(() => reopened.session?.cloud.status.kind === 'synced');
    expect(toHex(reopened.session?.keys.current.keyId ?? new Uint8Array())).not.toBe(oldKeyId);
    await reopened.session?.deviceSettings.loaded();
    expect(reopened.session?.deviceSettings.settings.lock.idle).toBe(IDLE_LOCK_MS);
  });

  it('changes nothing for a wrong password', async () => {
    const { device, store } = await linkedToWebDav();
    const session = store.session;
    assert(session !== null);
    const before = await cloudKeyId(device);

    await session.rotation.rotate('not the password');

    expect(session.rotation.state).toEqual({
      kind: 'failed',
      failure: 'wrong-password',
    });
    expect(store.lifecycle.kind).toBe('unlocked');
    expect(await cloudKeyId(device)).toBe(before);
  });

  it('is followed on another device with the password, keeping what it changed meanwhile', async () => {
    const cloud = aCloud();
    const first = await linkedToWebDav(aDevice({ cloud }));
    const secondDevice = aDevice({ cloud, seed: 8 });
    const second = await openedFromTheCloud(secondDevice);
    const vaultKey = second.session?.vaultKey ?? '';
    const meanwhile = aCard({ title: 'Made meanwhile' });
    second.session?.apply(document => ({
      ...document,
      cards: new Map([...document.cards, [meanwhile.id, meanwhile]]),
    }));

    await first.store.session?.rotation.rotate(TEST_PASSWORD);
    secondDevice.time.advance(CLOUD_PUSH_DEBOUNCE_MS);
    await when(() => second.session?.cloud.status.kind === 'stopped');
    expect(second.session?.cloud.status).toEqual({
      kind: 'stopped',
      reason: { kind: 'key-rotated' },
    });
    expect(second.lifecycle.kind).toBe('unlocked');

    await second.session?.rotation.follow(TEST_PASSWORD);
    await when(() => second.lifecycle.kind !== 'unlocked');
    second.dispose();
    const reopened = await unlockedAgain(secondDevice, vaultKey);
    await when(() => reopened.session?.cloud.status.kind === 'synced');

    expect(reopened.session?.document.cards.has(meanwhile.id)).toBe(true);
    expect(toHex(reopened.session?.keys.current.keyId ?? new Uint8Array())).toBe(
      await cloudKeyId(secondDevice)
    );
  });

  it('refuses the old key when the cloud puts a pre-rotation file back', async () => {
    const { device, store } = await linkedToWebDav();
    const session = store.session;
    assert(session !== null);
    const cloudStore = device.cloud.storeAt(TEST_FOLDER);
    assert(cloudStore !== undefined);
    const path = storagePath('Family.pwv');
    const before = await cloudStore.read(path, SIGNAL);
    assert(before.ok && before.value !== null);

    await session.rotation.rotate(TEST_PASSWORD);
    await when(() => store.lifecycle.kind !== 'unlocked');
    store.dispose();
    await cloudStore.write(path, before.value.bytes, { kind: 'overwrite' }, SIGNAL);
    const reopened = await unlockedAgain(device, session.vaultKey);
    await when(() => reopened.lifecycle.kind !== 'unlocked');

    expect(reopened.lifecycle).toMatchObject({ reason: 'rollback-security' });
  });

  it('keeps everything readable when another tab wrote the local copy meanwhile', async () => {
    const { device, store } = await linkedToWebDav();
    const session = store.session;
    assert(session !== null);
    session.deviceSettings.update({ lock: { idle: IDLE_LOCK_MS as Milliseconds, hidden: null } });
    await session.deviceSettings.saved();
    const localCopy = device.localCopyOf(session.vaultKey);
    vi.spyOn(localCopy, 'write').mockResolvedValueOnce({
      ok: true,
      value: { kind: 'conflict', current: null },
    });

    await session.rotation.rotate(TEST_PASSWORD);

    expect(session.rotation.state).toEqual({ kind: 'failed', failure: 'changed-meanwhile' });
    await when(() => store.lifecycle.kind !== 'unlocked');
    store.dispose();
    const reopened = await unlockedAgain(device, session.vaultKey);
    await when(() => reopened.session?.cloud.status.kind === 'stopped');
    await reopened.session?.deviceSettings.loaded();
    expect(reopened.session?.deviceSettings.settings.lock.idle).toBe(IDLE_LOCK_MS);
    await reopened.session?.rotation.follow(TEST_PASSWORD);
    await when(() => reopened.lifecycle.kind !== 'unlocked');
    reopened.dispose();

    const settled = await unlockedAgain(device, session.vaultKey);
    await when(() => settled.session?.cloud.status.kind === 'synced');
    await settled.session?.deviceSettings.loaded();
    expect(settled.session?.deviceSettings.settings.lock.idle).toBe(IDLE_LOCK_MS);
  });

  it('never leads a device that joined after the rotation back to the old key', async () => {
    const cloud = aCloud();
    const first = await linkedToWebDav(aDevice({ cloud }));
    const cloudStore = first.device.cloud.storeAt(TEST_FOLDER);
    assert(cloudStore !== undefined);
    const path = storagePath('Family.pwv');
    const beforeRotation = await cloudStore.read(path, SIGNAL);
    assert(beforeRotation.ok && beforeRotation.value !== null);
    await first.store.session?.rotation.rotate(TEST_PASSWORD);
    await when(() => first.store.lifecycle.kind !== 'unlocked');

    const lateDevice = aDevice({ cloud, seed: 9 });
    const late = await openedFromTheCloud(lateDevice);
    await cloudStore.write(path, beforeRotation.value.bytes, { kind: 'overwrite' }, SIGNAL);
    const session = late.session;
    assert(session !== null);
    session.cloud.requestPush();
    lateDevice.time.advance(CLOUD_PUSH_DEBOUNCE_MS);
    await when(() => late.lifecycle.kind !== 'unlocked');

    expect(late.lifecycle).toMatchObject({ reason: 'rollback-security' });
  });
});
