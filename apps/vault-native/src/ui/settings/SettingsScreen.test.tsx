import { render } from '@testing-library/react-native';
import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { UpdateWatch } from '@frozik/vault-app/release/application/UpdateWatch';

import { aDevice } from '@frozik/vault-app/testing/fake-device';
import { AppUnderTest } from '../testing/AppUnderTest';
import { unlockedVaultWith } from '../testing/unlocked-vault';
import { UpdateGate } from '../UpdateGate';

async function openSettings() {
  const vault = await unlockedVaultWith([]);
  await fireEvent.press(screen.getByTestId('tab-settings'));
  await screen.findByTestId('settings');
  return vault;
}

describe('the settings of the open vault on the phone', () => {
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
