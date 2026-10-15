import { assert } from '@frozik/utils/assert/assert';
import { when } from 'mobx';

import { LOCAL_COPY_PATH } from '../../sync/domain/local-copy';
import { aDevice, TEST_PASSWORD } from '../../testing/fake-device';

const SIGNAL = new AbortController().signal;

async function aVaultFile() {
  const maker = aDevice();
  const store = maker.startStore();
  store.create('Family', TEST_PASSWORD);
  await when(() => store.session !== null);
  const vaultKey = store.session?.vaultKey;
  assert(vaultKey !== undefined);
  const read = await maker.localCopyOf(vaultKey).read(LOCAL_COPY_PATH, SIGNAL);
  assert(read.ok && read.value !== null);
  return { vaultKey, bytes: read.value.bytes };
}

describe('opening a vault file on another device', () => {
  it('lists the vault under the file’s name and opens it with its password', async () => {
    const { vaultKey, bytes } = await aVaultFile();
    const device = aDevice({ seed: 9 });
    device.willPick({ bytes, name: 'Family.pwv' });
    const app = device.startStore();

    const opened = await app.fileOpening?.open();
    app.choose(vaultKey);
    app.unlock(TEST_PASSWORD);
    await when(() => app.session !== null);

    expect({ opened, names: app.registry.vaults.value?.map(vault => vault.name) }).toEqual({
      opened: vaultKey,
      names: ['Family'],
    });
  });

  it('says a file that is no vault is not one, and lists nothing', async () => {
    const device = aDevice();
    device.willPick({ bytes: Uint8Array.of(1, 2, 3), name: 'notes.txt' });
    const app = device.startStore();

    const opened = await app.fileOpening?.open();

    expect({ opened, state: app.fileOpening?.state }).toEqual({
      opened: null,
      state: { kind: 'failed', failure: { kind: 'not-a-vault' } },
    });
  });

  it('does nothing when the chooser was closed', async () => {
    const app = aDevice().startStore();

    expect([await app.fileOpening?.open(), app.fileOpening?.state]).toEqual([
      null,
      { kind: 'idle' },
    ]);
  });

  it('adds a vault file dropped on the screen, with no chooser in between', async () => {
    const { vaultKey, bytes } = await aVaultFile();
    const app = aDevice({ seed: 9 }).startStore();

    const opened = await app.fileOpening?.adopt({ bytes, name: 'Family.pwv' });

    expect({ opened, names: app.registry.vaults.value?.map(vault => vault.name) }).toEqual({
      opened: vaultKey,
      names: ['Family'],
    });
  });
});
