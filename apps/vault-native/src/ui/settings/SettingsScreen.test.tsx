import { render } from '@testing-library/react-native';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import type { AppStateStatus } from 'react-native';
import { AppState, Linking } from 'react-native';

import { UpdateWatch } from '@frozik/vault-app/release/application/UpdateWatch';

import { aDevice } from '@frozik/vault-app/testing/fake-device';
import { AppUnderTest } from '../testing/AppUnderTest';
import { openSettingsTopic } from '../testing/settings-topic';
import { unlockedVaultWith } from '../testing/unlocked-vault';
import { UpdateGate } from '../UpdateGate';

async function openSettings() {
  const vault = await unlockedVaultWith([]);
  await openSettingsTopic('security');
  return vault;
}

describe('the settings of the open vault on the phone', () => {
  afterEach(() => jest.restoreAllMocks());

  it('lists the topics, falls into one, and comes back to the list', async () => {
    await unlockedVaultWith([]);
    await fireEvent.press(screen.getByTestId('tab-settings'));

    await fireEvent.press(await screen.findByTestId('settings-topic-display'));
    const display = await screen.findByTestId('settings-display');
    const themeThere = screen.queryAllByTestId('show-recent').length;
    await fireEvent.press(screen.getByTestId('settings-back'));

    expect({
      display: display !== null,
      themeThere,
      list: await screen.findByTestId('settings'),
    }).toEqual({
      display: true,
      themeThere: 1,
      list: expect.anything(),
    });
    expect(screen.getByTestId('tab-settings')).toBeSelected();
  });

  it('leads to the phone’s settings when no fingerprint is set up, and offers the switch on coming back', async () => {
    const listeners: ((state: AppStateStatus) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      listeners.push(listener);
      return { remove: jest.fn() };
    });
    const sendIntent = jest.spyOn(Linking, 'sendIntent').mockResolvedValue(undefined);
    const vault = await unlockedVaultWith([]);
    vault.device.biometrics.sensor('none');
    await openSettingsTopic('security');

    await fireEvent.press(await screen.findByTestId('biometric-enrol'));
    vault.device.biometrics.sensor('strong');
    await act(() => listeners.forEach(listener => listener('active')));

    expect(await screen.findByTestId('biometric-switch-on')).toBeOnTheScreen();
    expect(sendIntent).toHaveBeenCalledTimes(1);
  });

  it('names the author in About and opens the homepage from the link', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await unlockedVaultWith([]);
    await openSettingsTopic('about');

    await fireEvent.press(screen.getByTestId('settings-homepage'));

    expect(screen.getByTestId('settings-author')).toBeOnTheScreen();
    expect(openURL).toHaveBeenCalledWith('https://frozik.github.io/portfolio/');
  });

  it('allows screenshots only once the user confirmed what that means', async () => {
    const { app } = await openSettings();

    await fireEvent.press(screen.getByTestId('allow-screenshots'));
    const beforeConfirming = app.session?.deviceSettings.settings.allowScreenshots;
    await fireEvent.press(screen.getByTestId('confirm-screenshots'));

    expect([beforeConfirming, app.session?.deviceSettings.settings.allowScreenshots]).toEqual([
      false,
      true,
    ]);
    expect(screen.getByTestId('block-screenshots')).toBeOnTheScreen();
  });

  it('keeps a shorter idle lock for this vault', async () => {
    const { app } = await openSettings();

    await fireEvent.press(screen.getByTestId('idle-lock'));
    await fireEvent.press(await screen.findByTestId('idle-lock-60000'));

    expect(app.session?.deviceSettings.settings.lock.idle).toBe(60_000);
    expect(screen.queryByTestId('idle-lock-60000')).toBeNull();
  });

  it('stops asking the icon service for site icons once the user turns them off', async () => {
    const { app } = await openSettings();

    await fireEvent.press(screen.getByTestId('load-site-icons'));

    expect(app.session?.deviceSettings.settings.loadSiteIcons).toBe(false);
  });

  it('sets up a PIN for quick unlock with the master password, the PIN twice', async () => {
    const { app } = await openSettings();

    await fireEvent.press(screen.getByTestId('quick-set-up'));
    await fireEvent.changeText(screen.getByTestId('quick-master'), 'correct horse battery staple');
    await fireEvent.press(screen.getByTestId('quick-check'));
    await fireEvent.press(await screen.findByTestId('quick-kind-pin'));
    await fireEvent.changeText(screen.getByTestId('quick-pin'), '2468');
    await fireEvent.press(screen.getByTestId('quick-next'));
    await fireEvent.changeText(screen.getByTestId('quick-pin'), '2468');
    await fireEvent.press(screen.getByTestId('quick-next'));

    await waitFor(() => expect(app.session?.deviceSettings.settings.quickUnlock?.kind).toBe('pin'));
    const keptAtFirst = app.session?.deviceSettings.settings.quickUnlock?.keepOverRestart;
    await fireEvent.press(screen.getByTestId('quick-master-after-restart'));

    expect([
      keptAtFirst,
      app.session?.deviceSettings.settings.quickUnlock?.keepOverRestart,
    ]).toEqual([true, false]);
  });
});

describe('a build below the published floor', () => {
  it('shows only why it waits', async () => {
    const updates = new UpdateWatch(
      {
        read: () =>
          Promise.resolve({
            android: { latest: 'v2.0.0', minimum: 'v2.0.0', apkUrl: '', sha256: '' },
          }),
      },
      { client: 'android', version: 'v1.4.0' }
    );
    await updates.check();

    await render(
      <AppUnderTest app={aDevice().startStore()} updates={updates}>
        <UpdateGate updates={updates}>{null}</UpdateGate>
      </AppUnderTest>
    );

    expect(screen.getByTestId('update-required')).toBeOnTheScreen();
  });
});
