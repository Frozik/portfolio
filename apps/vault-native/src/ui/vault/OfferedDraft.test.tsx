import { renameCard, putCard } from '@frozik/vault/model/card-edits';
import { aCardWith } from '@frozik/vault/testing/builders';
import { act, fireEvent, screen } from 'expo-router/testing-library';
import { when } from 'mobx';

import { aDevice, TEST_PASSWORD } from '@frozik/vault-app/testing/fake-device';

import { OPEN_VAULT_ROUTES } from '../testing/open-vault-routes';
import { renderApp } from '../testing/render-app';

const BANK = aCardWith([], { title: 'Bank' });

/** Bank half-renamed when the vault locked; the app starts over and the vault is opened again. */
async function draftLeftByALock() {
  const device = aDevice();
  const maker = device.startStore();
  maker.create('Family', TEST_PASSWORD);
  await when(() => maker.session !== null);
  const session = maker.session;
  if (session === null) {
    throw new Error('the vault did not open');
  }
  session.apply(document => putCard(document, BANK));
  await when(() => session.local.state.phase.kind === 'idle');
  session.editing.startEditing(BANK.id);
  session.editing.draft?.change(card => renameCard(card, 'Bank (half typed)'));
  const { vaultKey } = session;
  maker.lock('manual');
  await when(() => maker.lifecycle.kind === 'locked');
  const rendered = await renderApp(OPEN_VAULT_ROUTES, { device, initialUrl: `/${vaultKey}` });
  await act(() => rendered.app.registry.refresh());
  await fireEvent.changeText(screen.getByTestId('unlock-password'), TEST_PASSWORD);
  await fireEvent.press(screen.getByTestId('unlock-submit'));
  await screen.findByTestId('card-list-screen');
  return rendered;
}

describe('an edit a lock left unsaved', () => {
  it('opens its card straight in the editor, not the card as read', async () => {
    await draftLeftByALock();
    await screen.findByTestId('offered-draft');

    await fireEvent.press(screen.getByTestId('card-row'));

    expect(await screen.findByTestId('card-editor')).toBeOnTheScreen();
    expect(screen.getByTestId('editor-title')).toHaveDisplayValue('Bank (half typed)');
  });

  it('is thrown away from its notice', async () => {
    const { app } = await draftLeftByALock();

    await fireEvent.press(await screen.findByTestId('discard-draft'));

    expect(screen.queryByTestId('offered-draft')).not.toBeOnTheScreen();
    expect(app.session?.editing.canStart).toBe(true);
  });
});
