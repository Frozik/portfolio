import { storagePath } from '@frozik/cloud-storage/core/storage-path';
import { createMemoryProvider } from '@frozik/cloud-storage/memory/memory-provider';
import { assert } from '@frozik/utils/assert/assert';
import type { Milliseconds } from '@frozik/utils/date/types';
import { createIndexedDbDeviceStores } from '@frozik/vault/persistence/indexeddb/device-stores';
import { vaultKeyOf } from '@frozik/vault/session/vault-key-of';
import { aCard } from '@frozik/vault/testing/builders';
import { createSeededRandom } from '@frozik/vault/testing/seeded-random';
import { when } from 'mobx';

import { LOCAL_COPY_PATH } from '../domain/local-copy';
import { adoptCloudVault } from './cloud-adoption';
import { CLOUD_PULL_EVERY_MS, CLOUD_PUSH_DEBOUNCE_MS } from './CloudLink';
import {
  aCloud,
  aDevice,
  linkedToWebDav,
  TEST_FOLDER as FOLDER,
  TEST_PASSWORD as PASSWORD,
} from './fake-device.test-helper';

const SIGNAL = new AbortController().signal;
const IDLE_LOCK_LONGER_MS = 60 * 60 * 1000;

describe('a vault kept in a cloud', () => {
  it('writes itself into the checked folder, its home known to the session but not to the list', async () => {
    const { device, store } = await linkedToWebDav();

    const stored = await device.cloud.storeAt(FOLDER)?.stat(storagePath('Family.pwv'), SIGNAL);

    expect(stored).toMatchObject({ ok: true, value: { path: 'Family.pwv' } });
    expect(store.session?.cloud.location).toEqual({
      kind: 'webdav',
      url: FOLDER,
      username: 'me',
      path: 'Family.pwv',
    });
    expect(Object.keys(store.registry.entryOf(store.session?.vaultKey ?? '') ?? {}).sort()).toEqual(
      ['description', 'lastOpenedAt', 'name', 'unsyncedChanges', 'vaultKey']
    );
    expect(store.cloud.webDavForm).toBeNull();
  });

  it('pushes an edit once the edits pause, not with every keystroke', async () => {
    const { device, store } = await linkedToWebDav();
    const cloudFile = () => device.cloud.storeAt(FOLDER)?.stat(storagePath('Family.pwv'), SIGNAL);
    const before = await cloudFile();

    store.session?.apply(document => ({
      ...document,
      settings: { ...document.settings, name: 'Family & friends' },
    }));
    await when(() => store.session?.local.state.phase.kind === 'idle');
    const meanwhile = await cloudFile();
    device.time.advance(CLOUD_PUSH_DEBOUNCE_MS);
    await when(() => store.session?.cloud.status.kind === 'synced');

    expect(meanwhile).toEqual(before);
    expect(await cloudFile()).not.toEqual(before);
  });

  it('looks for other devices’ changes every few minutes, but not while the tab is hidden', async () => {
    const { device, store } = await linkedToWebDav();
    store.session?.deviceSettings.update({
      lock: { idle: IDLE_LOCK_LONGER_MS as Milliseconds, hidden: null },
    });
    const cloudStore = device.cloud.storeAt(FOLDER);
    const stat = cloudStore === undefined ? null : vi.spyOn(cloudStore, 'stat');

    device.time.advance(CLOUD_PULL_EVERY_MS);
    const whileVisible = stat?.mock.calls.length;
    device.page.setHidden(true);
    await Promise.resolve();
    stat?.mockClear();
    device.time.advance(CLOUD_PULL_EVERY_MS);

    expect(whileVisible).toBe(1);
    expect(stat).not.toHaveBeenCalled();
  });

  it('picks the cloud up again at the next unlock, with the password sealed on this device', async () => {
    const { device, store } = await linkedToWebDav();
    const vaultKey = store.session?.vaultKey ?? '';
    store.dispose();

    const next = device.startStore();
    next.choose(vaultKey);
    next.unlock(PASSWORD);
    await when(() => next.session?.cloud.status.kind === 'synced');

    expect(device.cloud.given().at(-1)).toMatchObject({ password: 'app-password' });
  });

  it('stays on this device only once the cloud is disconnected', async () => {
    const { store } = await linkedToWebDav();

    const session = store.session;
    if (session !== null) {
      await store.cloud.disconnect(session);
    }

    expect(store.session?.cloud.status).toEqual({ kind: 'none' });
    expect(store.session?.cloud.location).toBeNull();
  });
});

describe('two devices and one cloud', () => {
  it('opens on a second device from the cloud, and each sees what the other added', async () => {
    const cloud = aCloud();
    const first = await linkedToWebDav(aDevice({ cloud }));
    const added = aCard({ title: 'Bank' });
    first.store.session?.apply(document => ({
      ...document,
      cards: new Map([...document.cards, [added.id, added]]),
    }));
    first.device.time.advance(CLOUD_PUSH_DEBOUNCE_MS);
    await when(() => first.store.session?.cloud.status.kind === 'synced');

    const secondDevice = aDevice({ cloud, seed: 8 });
    const second = secondDevice.startStore();
    second.cloud.openWebDavForm();
    second.cloud.webDavForm?.setEndpoint(FOLDER);
    second.cloud.webDavForm?.setUsername('me');
    second.cloud.webDavForm?.setPassword('app-password');
    await second.cloud.webDavForm?.runCheck();
    const vaultKey = await second.cloud.openFromWebDav(storagePath('Family.pwv'));
    second.choose(vaultKey ?? '');
    second.unlock(PASSWORD);
    await when(() => second.session?.cloud.status.kind === 'synced');

    const reply = aCard({ title: 'Mail' });
    second.session?.apply(document => ({
      ...document,
      cards: new Map([...document.cards, [reply.id, reply]]),
    }));
    secondDevice.time.advance(CLOUD_PUSH_DEBOUNCE_MS);
    await when(() => second.session?.cloud.status.kind === 'synced');
    first.device.page.setHidden(true);
    first.device.page.setHidden(false);
    await when(() => first.store.session?.document.cards.has(reply.id) === true);

    const snapshots = await first.device.snapshots.list(vaultKey ?? '');
    expect(snapshots.ok && snapshots.value.map(snapshot => snapshot.reason)).toEqual([
      'before-sync',
      'periodic',
    ]);
    expect(vaultKey).toBe(first.store.session?.vaultKey);
    expect(second.session?.document.cards.get(added.id)?.title).toBe('Bank');
    expect(second.session?.cloud.location).toMatchObject({ kind: 'webdav' });
  });
});

describe('another vault at the same address', () => {
  it('stops instead of merging, and replaces the file only when asked', async () => {
    const cloud = aCloud();
    await linkedToWebDav(aDevice({ cloud }));
    const other = aDevice({ cloud, seed: 9 });
    const store = other.startStore();
    store.create('Family', PASSWORD);
    await when(() => store.session !== null);
    store.cloud.openWebDavForm();
    store.cloud.webDavForm?.setEndpoint(FOLDER);
    store.cloud.webDavForm?.setUsername('me');
    store.cloud.webDavForm?.setPassword('app-password');
    await store.cloud.webDavForm?.runCheck();
    const session = store.session;
    if (session !== null) {
      await store.cloud.keepInWebDav(session);
    }
    await when(() => session?.cloud.status.kind === 'stopped');
    const stopped = session?.cloud.status;

    await session?.cloud.replaceRemote();
    await when(() => session?.cloud.status.kind === 'synced');
    const read = await cloud.storeAt(FOLDER)?.read(storagePath('Family.pwv'), SIGNAL);

    expect(stopped).toEqual({ kind: 'stopped', reason: { kind: 'foreign-vault' } });
    expect(read?.ok && read.value !== null && vaultKeyOf(read.value.bytes)).toBe(session?.vaultKey);
  });
});

describe('cloud link edge cases', () => {
  it('uploads nothing when the tab is hidden with nothing new to push', async () => {
    const { device, store } = await linkedToWebDav();
    const cloudStore = device.cloud.storeAt(FOLDER);
    const write = cloudStore === undefined ? null : vi.spyOn(cloudStore, 'write');

    device.page.setHidden(true);
    await when(() => store.session?.cloud.status.kind === 'synced');

    expect(write).not.toHaveBeenCalled();
  });

  it('starts no sync for a link that finishes after the session ended', async () => {
    const device = aDevice();
    const store = device.startStore();
    store.create('Family', PASSWORD);
    await when(() => store.session !== null);
    const session = store.session;
    const connection = device.cloud.connect(
      { kind: 'webdav', url: FOLDER, username: 'me', path: 'Family.pwv' },
      {
        password: 'app-password',
        features: { conditionalRequests: false, moveReplace: true, revisionKind: 'etag' },
      }
    );

    const linking = connection === null ? null : session?.cloud.link(connection, null);
    session?.dispose();
    await linking;

    expect(session?.cloud.sync).toBeNull();
    expect(session?.cloud.leader).toBe(false);
  });
});

describe('adopting a vault found in a cloud', () => {
  it('replaces a local copy a forgotten vault left behind with the one downloaded', async () => {
    const { device } = await linkedToWebDav();
    const connection = device.cloud.connect(
      { kind: 'webdav', url: FOLDER, username: 'me', path: 'Family.pwv' },
      {
        password: 'app-password',
        features: { conditionalRequests: false, moveReplace: true, revisionKind: 'etag' },
      }
    );
    const leftover = createMemoryProvider();
    await leftover.write(LOCAL_COPY_PATH, Uint8Array.of(9), { kind: 'absent' }, SIGNAL);
    const registry = createIndexedDbDeviceStores(createSeededRandom(3), 'pwv:test-adopt').registry;
    assert(connection !== null);

    const adopted = await adoptCloudVault(
      { connection, localCopyOf: () => leftover, registry },
      SIGNAL
    );
    const cloudFile = await connection.storage.read(storagePath('Family.pwv'), SIGNAL);
    const localFile = await leftover.read(LOCAL_COPY_PATH, SIGNAL);

    expect(adopted.ok).toBe(true);
    assert(cloudFile.ok && localFile.ok);
    expect(localFile.value?.bytes).toEqual(cloudFile.value?.bytes);
  });
});
