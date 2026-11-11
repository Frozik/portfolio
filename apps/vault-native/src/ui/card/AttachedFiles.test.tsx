import { utf8 } from '@frozik/vault/crypto/bytes';
import { addAsset } from '@frozik/vault/model/asset-edits';
import { putCard } from '@frozik/vault/model/card-edits';
import { aCardWith, aField } from '@frozik/vault/testing/builders';
import { createSeededRandom } from '@frozik/vault/testing/seeded-random';
import { act, fireEvent, screen } from 'expo-router/testing-library';
import { when } from 'mobx';

import type { IFileToSave } from '@frozik/vault-app/interchange/domain/ports/file-saver';
import { aDevice, TEST_PASSWORD } from '@frozik/vault-app/testing/fake-device';

import { OPEN_VAULT_ROUTES } from '../testing/open-vault-routes';
import { renderApp } from '../testing/render-app';

const TEXT = 'Recovery codes: 1111 2222';

/** A vault with one card holding one text file, opened on that card with the master password. */
async function aCardWithAFile() {
  const device = aDevice();
  const maker = device.startStore();
  maker.create('Family', TEST_PASSWORD);
  await when(() => maker.session !== null);
  const session = maker.session;
  if (session === null) {
    throw new Error('the vault did not open');
  }
  const card = aCardWith([], { title: 'Mail' });
  session.apply((document, at) => {
    const added = addAsset(
      document,
      { name: 'codes.txt', mime: 'text/plain', sha256: '0'.repeat(64), bytes: utf8(TEXT) },
      at,
      createSeededRandom(1)
    );
    return putCard(
      added.document,
      aCardWith([aField({ kind: 'file' }, [added.assetId])], { id: card.id, title: 'Mail' })
    );
  });
  await when(() => session.local.state.phase.kind === 'idle');
  const { vaultKey } = session;
  maker.lock('manual');
  const saved: IFileToSave[] = [];
  const keep = (file: IFileToSave) => {
    saved.push(file);
    return Promise.resolve('saved' as const);
  };
  const rendered = await renderApp(OPEN_VAULT_ROUTES, {
    device,
    initialUrl: `/${vaultKey}/all/${card.id}`,
    fileSavers: { saveToFolder: keep, share: keep },
  });
  await act(() => rendered.app.registry.refresh());
  await fireEvent.changeText(screen.getByTestId('unlock-password'), TEST_PASSWORD);
  await fireEvent.press(screen.getByTestId('unlock-submit'));
  await screen.findByTestId('attached-file');
  return { saved };
}

describe('a card’s files on the phone', () => {
  it('shows a text file here, by its own words', async () => {
    await aCardWithAFile();

    await fireEvent.press(screen.getByTestId('attached-file-preview'));

    expect((await screen.findByTestId('attached-file-text')).props.children).toBe(TEXT);
  });

  it('saves a file into a folder the user picks, by its name, as it is', async () => {
    const { saved } = await aCardWithAFile();

    await fireEvent.press(screen.getByTestId('attached-file-save'));
    await screen.findByTestId('attached-file-saved');

    expect(saved.map(file => ({ ...file, bytes: [...file.bytes] }))).toEqual([
      { name: 'codes.txt', mime: 'text/plain', bytes: [...utf8(TEXT)] },
    ]);
  });
});
