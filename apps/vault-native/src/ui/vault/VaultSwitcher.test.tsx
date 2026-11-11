import { act, fireEvent, screen, waitFor, within } from 'expo-router/testing-library';
import { when } from 'mobx';

import { aDevice, TEST_PASSWORD } from '@frozik/vault-app/testing/fake-device';

import { OPEN_VAULT_ROUTES } from '../testing/open-vault-routes';
import { renderApp } from '../testing/render-app';

async function twoVaultsOpenOn(first: string, second: string) {
  const device = aDevice();
  const maker = device.startStore();
  const keys: string[] = [];
  for (const name of [first, second]) {
    maker.create(name, TEST_PASSWORD);
    await when(() => maker.session !== null);
    keys.push(maker.session?.vaultKey ?? '');
    maker.lock('complete');
  }
  const [firstKey, secondKey] = keys;
  const rendered = await renderApp(OPEN_VAULT_ROUTES, { device, initialUrl: `/${firstKey}` });
  await act(() => rendered.app.registry.refresh());
  await fireEvent.changeText(screen.getByTestId('unlock-password'), TEST_PASSWORD);
  await fireEvent.press(screen.getByTestId('unlock-submit'));
  await screen.findByTestId('card-list-screen');
  return { ...rendered, firstKey, secondKey };
}

describe('the open vault’s switcher', () => {
  it('lists the phone’s vaults with the open one marked', async () => {
    await twoVaultsOpenOn('Family', 'Work');

    await fireEvent.press(screen.getByTestId('vault-switcher'));

    const entries = within(screen.getByTestId('vault-sheet')).getAllByTestId('switch-vault');
    expect(
      entries.map(entry => ({
        name: within(entry).getAllByRole('text')[0]?.props.children,
        open: entry.props.accessibilityState?.selected,
      }))
    ).toEqual(
      expect.arrayContaining([
        { name: 'Family', open: true },
        { name: 'Work', open: false },
      ])
    );
  });

  it('moves to another vault: the open one locks, the other asks for its password', async () => {
    const { app, getPathname, secondKey } = await twoVaultsOpenOn('Family', 'Work');

    await fireEvent.press(screen.getByTestId('vault-switcher'));
    const other = screen
      .getAllByTestId('switch-vault')
      .find(entry => entry.props.accessibilityState?.selected !== true);
    await fireEvent.press(other ?? screen.getByTestId('vault-sheet'));

    await waitFor(() => expect(getPathname()).toBe(`/${secondKey}`));
    expect(await screen.findByTestId('unlock-password')).toBeOnTheScreen();
    expect(app.session).toBeNull();
  });
});
