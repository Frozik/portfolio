import type { Milliseconds } from '@frozik/utils/date/types';
import { Slot, useLocalSearchParams } from 'expo-router';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { when } from 'mobx';
import { View } from 'react-native';

import { aDevice, TEST_PASSWORD } from '@frozik/vault-app/testing/fake-device';

import { renderApp } from '../testing/render-app';
import { unlockedVaultWith } from '../testing/unlocked-vault';
import { VaultScreen } from './VaultScreen';

const ROUTES = {
  index: () => <View testID="start" />,
  '[vaultId]/_layout': () => <RoutedVault />,
  '[vaultId]/index': () => <View testID="vault-page" />,
};

function RoutedVault() {
  const { vaultId } = useLocalSearchParams<{ vaultId: string }>();
  return (
    <VaultScreen vaultKey={vaultId}>
      <Slot />
    </VaultScreen>
  );
}

/** A vault made on this phone and locked; the app starts over, as after the lock's reload. */
async function lockedVault({ withBiometrics = false } = {}) {
  const device = aDevice();
  const maker = device.startStore();
  maker.create('Family', TEST_PASSWORD);
  await when(() => maker.session !== null);
  const session = maker.session;
  if (session === null) {
    throw new Error('the vault did not open');
  }
  if (withBiometrics) {
    await session.flows.deviceUnlockOf()?.switchOn(TEST_PASSWORD);
  }
  const { vaultKey } = session;
  maker.lock('manual');
  const rendered = await renderApp(ROUTES, { device, initialUrl: `/${vaultKey}` });
  await act(() => rendered.app.registry.refresh());
  return { ...rendered, vaultKey };
}

const QUICK_LIFETIME_MS = (4 * 60 * 60 * 1000) as Milliseconds;

describe('a locked vault on the phone', () => {
  it('opens with the master password', async () => {
    await lockedVault();

    await fireEvent.changeText(screen.getByTestId('unlock-password'), TEST_PASSWORD);
    await fireEvent.press(screen.getByTestId('unlock-submit'));

    await waitFor(() => expect(screen.getByTestId('open-vault')).toBeOnTheScreen());
  });

  it('keeps the typed password, locked against edits, while it is checked', async () => {
    await lockedVault();

    await fireEvent.changeText(screen.getByTestId('unlock-password'), TEST_PASSWORD);
    await fireEvent.press(screen.getByTestId('unlock-submit'));

    const field = screen.getByTestId('unlock-password');
    expect({ value: field.props.value, editable: field.props.editable }).toEqual({
      value: TEST_PASSWORD,
      editable: false,
    });
  });

  it('clears a wrong password and lets the next one be typed', async () => {
    await lockedVault();

    await fireEvent.changeText(screen.getByTestId('unlock-password'), 'not the password');
    await fireEvent.press(screen.getByTestId('unlock-submit'));
    await screen.findByTestId('unlock-failure');

    const field = screen.getByTestId('unlock-password');
    expect({ value: field.props.value, editable: field.props.editable }).toEqual({
      value: '',
      editable: true,
    });
  });

  it('says the password is wrong and stays locked', async () => {
    await lockedVault();

    await fireEvent.changeText(screen.getByTestId('unlock-password'), 'not the password');
    await fireEvent.press(screen.getByTestId('unlock-submit'));

    await waitFor(() => expect(screen.getByTestId('unlock-failure')).toBeOnTheScreen());
    expect(screen.queryByTestId('open-vault')).toBeNull();
  });

  it('offers the fingerprint only once it holds the vault, and opens with it', async () => {
    await lockedVault({ withBiometrics: true });

    await fireEvent.press(await screen.findByTestId('unlock-biometric'));

    await waitFor(() => expect(screen.getByTestId('open-vault')).toBeOnTheScreen());
  });

  it('offers no fingerprint for a vault it does not hold', async () => {
    await lockedVault();

    await waitFor(() => expect(screen.getByTestId('unlock-password')).toBeOnTheScreen());
    expect(screen.queryByTestId('unlock-biometric')).toBeNull();
  });

  it('says a vault this phone does not know is not here', async () => {
    const rendered = await renderApp(ROUTES, { initialUrl: '/unknown' });
    await act(() => rendered.app.registry.refresh());

    expect(screen.getByTestId('vault-not-found')).toBeOnTheScreen();
  });
});

describe('the open vault', () => {
  it('offers the fingerprint after a master-password unlock, asking the password once more', async () => {
    const { device, vaultKey } = await lockedVault();
    await fireEvent.changeText(screen.getByTestId('unlock-password'), TEST_PASSWORD);
    await fireEvent.press(screen.getByTestId('unlock-submit'));

    await fireEvent.press(await screen.findByTestId('biometric-offer-open'));
    await fireEvent.changeText(await screen.findByTestId('biometric-password'), TEST_PASSWORD);
    await fireEvent.press(screen.getByTestId('biometric-switch-on'));

    await waitFor(() => expect(screen.queryByTestId('biometric-offer')).toBeNull());
    expect(device.biometrics.kept(vaultKey)).toBeDefined();
  });

  it('goes from the quick code to the master password and back again', async () => {
    const { app } = await unlockedVaultWith([]);
    await act(async () => {
      app.session?.deviceSettings.update({
        quickUnlock: {
          kind: 'pin',
          code: 'pin:1234',
          lifetimeMs: QUICK_LIFETIME_MS,
          hideLine: false,
          keepOverRestart: true,
        },
      });
      await when(() => app.lifecycle.kind === 'unlocked' && app.lifecycle.quickReady);
      app.lock('idle');
    });
    await fireEvent.press(await screen.findByTestId('use-master-password'));

    await fireEvent.press(await screen.findByTestId('use-quick'));

    expect(await screen.findByTestId('quick-unlock')).toBeOnTheScreen();
  });
});
