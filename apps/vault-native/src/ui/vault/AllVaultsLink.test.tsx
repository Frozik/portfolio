import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { when } from 'mobx';

import { aDevice, TEST_PASSWORD } from '@frozik/vault-app/testing/fake-device';

import { OPEN_VAULT_ROUTES } from '../testing/open-vault-routes';
import { renderApp } from '../testing/render-app';
import { unlockedVaultWith } from '../testing/unlocked-vault';

describe('leaving a locked vault for the others', () => {
  it('goes from the unlock screen to the list of every vault, even with nothing before it', async () => {
    const device = aDevice();
    const maker = device.startStore();
    maker.create('Family', TEST_PASSWORD);
    await when(() => maker.session !== null);
    const vaultKey = maker.session?.vaultKey;
    maker.lock('manual');
    const rendered = await renderApp(OPEN_VAULT_ROUTES, { device, initialUrl: `/${vaultKey}` });
    await act(() => rendered.app.registry.refresh());
    await screen.findByTestId('unlock-password');

    await fireEvent.press(screen.getByTestId('all-vaults'));

    await waitFor(() => expect(rendered.getPathname()).toBe('/'));
    expect(screen.getByTestId('start')).toBeOnTheScreen();
  });

  it('goes from an open vault to the list of every vault', async () => {
    const { getPathname, app } = await unlockedVaultWith([]);

    await fireEvent.press(screen.getByTestId('all-vaults'));

    await waitFor(() => expect(getPathname()).toBe('/'));
    expect({
      open: app.session !== null,
      marked: screen.queryAllByTestId('vault-open').length,
    }).toEqual({
      open: true,
      marked: 1,
    });
  });
});
