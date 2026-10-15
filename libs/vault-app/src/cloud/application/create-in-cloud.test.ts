import { storagePath } from '@frozik/cloud-storage/core/storage-path';
import { when } from 'mobx';

import type { VaultApp } from '../../session/application/VaultApp';
import { aCloud, aDevice, TEST_FOLDER, TEST_PASSWORD } from '../../testing/fake-device';

const SIGNAL = new AbortController().signal;

async function checkedEmptyFolder(store: VaultApp) {
  store.cloud.openWebDavForm();
  store.cloud.webDavForm?.setEndpoint(TEST_FOLDER);
  store.cloud.webDavForm?.setUsername('me');
  store.cloud.webDavForm?.setPassword('app-password');
  await store.cloud.webDavForm?.runCheck();
}

describe('a new vault made right in a cloud folder', () => {
  it('lives in the checked folder from the start', async () => {
    const cloud = aCloud();
    const store = aDevice({ cloud }).startStore();
    await checkedEmptyFolder(store);

    expect(store.cloud.prepareNewVaultHere('Family')).toBe(true);
    store.create('Family', TEST_PASSWORD);
    await when(() => store.session?.cloud.status.kind === 'synced');

    const written = await cloud.storeAt(TEST_FOLDER)?.stat(storagePath('Family.pwv'), SIGNAL);
    expect(written?.ok && written.value !== null).toBe(true);
  });

  it('links no vault the device already knew, even when the creation never happened', async () => {
    const cloud = aCloud();
    const device = aDevice({ cloud });
    const first = device.startStore();
    first.create('Home', TEST_PASSWORD);
    await when(() => first.session !== null);
    const known = first.session?.vaultKey ?? '';
    first.lock('left');

    const store = device.startStore();
    await store.registry.refresh();
    await checkedEmptyFolder(store);
    store.cloud.prepareNewVaultHere('Family');
    store.choose(known);
    store.unlock(TEST_PASSWORD);
    await when(() => store.session !== null);

    expect(store.session?.cloud.location).toBeNull();
    expect(await cloud.storeAt(TEST_FOLDER)?.list(storagePath(''), SIGNAL)).toEqual({
      ok: true,
      value: [],
    });
  });
});
