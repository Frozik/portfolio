import type { IVaultCard } from '@frozik/vault/model/card';
import { putCard } from '@frozik/vault/model/card-edits';
import { act, fireEvent, screen } from 'expo-router/testing-library';
import { when } from 'mobx';

import { aDevice, TEST_PASSWORD } from '@frozik/vault-app/testing/fake-device';

import { OPEN_VAULT_ROUTES } from './open-vault-routes';
import { renderApp } from './render-app';

/** A vault "Family" with these cards, locked, then opened with its password on the app's own screens. */
export async function unlockedVaultWith(
  cards: readonly IVaultCard[],
  { siteIcons }: Pick<NonNullable<Parameters<typeof aDevice>[0]>, 'siteIcons'> = {}
) {
  const device = aDevice({ siteIcons });
  const maker = device.startStore();
  maker.create('Family', TEST_PASSWORD);
  await when(() => maker.session !== null);
  const session = maker.session;
  if (session === null) {
    throw new Error('the vault did not open');
  }
  session.apply(document => cards.reduce(putCard, document));
  await when(() => session.local.state.phase.kind === 'idle');
  const { vaultKey } = session;
  maker.lock('manual');
  const rendered = await renderApp(OPEN_VAULT_ROUTES, { device, initialUrl: `/${vaultKey}` });
  await act(() => rendered.app.registry.refresh());
  await fireEvent.changeText(screen.getByTestId('unlock-password'), TEST_PASSWORD);
  await fireEvent.press(screen.getByTestId('unlock-submit'));
  await screen.findByTestId('card-list-screen');
  return { ...rendered, device, vaultKey };
}
