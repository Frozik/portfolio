import { NATIVE_PALETTES } from '@frozik/components/tokens/native-tokens';
import { router, Stack } from 'expo-router';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { when } from 'mobx';
import { View } from 'react-native';

import { UpdateWatch } from '@frozik/vault-app/release/application/UpdateWatch';
import { LOCAL_COPY_PATH } from '@frozik/vault-app/sync/domain/local-copy';
import { aDevice, TEST_PASSWORD } from '@frozik/vault-app/testing/fake-device';

import { TEST_VERSION } from '../testing/AppUnderTest';
import { renderApp } from '../testing/render-app';
import { StartScreen } from './StartScreen';

const Elsewhere = () => <View testID="elsewhere" />;
const ROUTES = {
  index: () => <StartScreen />,
  new: Elsewhere,
  import: Elsewhere,
  open: Elsewhere,
  '[vaultId]': Elsewhere,
};

describe('the start screen', () => {
  it('says this phone knows no vault yet, and offers both ways to get one', async () => {
    const { app } = await renderApp(ROUTES);

    await act(() => app.registry.refresh());

    expect(screen.getByTestId('no-vaults')).toBeOnTheScreen();
    expect(screen.getByTestId('open-from-cloud')).toBeOnTheScreen();
    expect(screen.getByTestId('create-vault')).toBeOnTheScreen();
  });

  it('lists the vaults this phone knows and opens the one tapped', async () => {
    const device = aDevice();
    const maker = device.startStore();
    maker.create('Family', TEST_PASSWORD);
    await when(() => maker.session !== null);
    const vaultKey = maker.session?.vaultKey;
    const rendered = await renderApp(ROUTES, { device });
    await act(() => rendered.app.registry.refresh());

    await fireEvent.press(screen.getByTestId('vault-row'));

    expect(rendered.getPathname()).toBe(`/${vaultKey}`);
  });

  it('opens a vault file picked from the phone and goes to its unlock', async () => {
    const maker = aDevice();
    const store = maker.startStore();
    store.create('Family', TEST_PASSWORD);
    await when(() => store.session !== null);
    const vaultKey = store.session?.vaultKey ?? '';
    const read = await maker
      .localCopyOf(vaultKey)
      .read(LOCAL_COPY_PATH, new AbortController().signal);
    const device = aDevice({ seed: 9 });
    device.willPick(
      read.ok && read.value !== null ? { bytes: read.value.bytes, name: 'Family.pwv' } : null
    );
    const rendered = await renderApp(ROUTES, { device });

    await fireEvent.press(screen.getByTestId('open-file'));

    await waitFor(() => expect(rendered.getPathname()).toBe(`/${vaultKey}`));
  });

  it('asks where a picked file that is no vault of its own is imported', async () => {
    const device = aDevice();
    device.willPick({ bytes: Uint8Array.of(1, 2, 3), name: 'export.db' });
    const rendered = await renderApp(ROUTES, { device });

    await fireEvent.press(screen.getByTestId('open-file'));

    await waitFor(() => expect(rendered.getPathname()).toBe('/import'));
  });

  const releasedUpTo = (latest: string) => ({
    read: () => Promise.resolve({ android: { latest, minimum: 'v1.0.0', apkUrl: '', sha256: '' } }),
  });

  it('names the running version on the title line', async () => {
    await renderApp(ROUTES);

    expect(screen.getByTestId('app-version')).toHaveTextContent(TEST_VERSION);
  });

  it('offers a newer release on the title line', async () => {
    const updates = new UpdateWatch(releasedUpTo('v2.0.0'), {
      client: 'android',
      version: 'v1.4.0',
    });
    await renderApp(ROUTES, { updates });

    await act(() => updates.check());

    expect(screen.getByTestId('update-link')).toBeOnTheScreen();
  });

  it('offers no release to a local build, which carries none', async () => {
    const updates = new UpdateWatch(releasedUpTo('v2.0.0'), {
      client: 'android',
      version: 'dev',
    });
    await renderApp(ROUTES, { updates });

    await act(() => updates.check());

    expect(screen.queryByTestId('update-link')).toBeNull();
  });

  it('marks a vault this phone opens with a fingerprint', async () => {
    const device = aDevice();
    const maker = device.startStore();
    maker.create('Family', TEST_PASSWORD);
    await when(() => maker.session !== null);
    await maker.session?.flows.deviceUnlockOf()?.switchOn(TEST_PASSWORD);
    maker.lock('manual');
    const other = device.startStore();
    other.create('Work', TEST_PASSWORD);
    await when(() => other.session !== null);
    other.lock('manual');
    const rendered = await renderApp(ROUTES, { device });

    await act(() => rendered.app.registry.refresh());

    expect(await screen.findByTestId('vault-biometric')).toBeOnTheScreen();
    expect(screen.getAllByTestId('vault-row')).toHaveLength(2);
    expect(screen.getAllByTestId('vault-biometric')).toHaveLength(1);
  });

  it('marks a vault once the fingerprint is switched on elsewhere and the list is back in sight', async () => {
    const device = aDevice();
    const maker = device.startStore();
    maker.create('Family', TEST_PASSWORD);
    await when(() => maker.session !== null);
    const setup = maker.session?.flows.deviceUnlockOf();
    const rendered = await renderApp({ _layout: () => <Stack />, ...ROUTES }, { device });
    await act(() => rendered.app.registry.refresh());
    await act(() => router.push('/new'));

    await act(() => setup?.switchOn(TEST_PASSWORD));
    await act(() => router.back());

    expect(await screen.findByTestId('vault-biometric')).toBeOnTheScreen();
  });

  it('goes to creating a vault', async () => {
    const rendered = await renderApp(ROUTES);

    await fireEvent.press(screen.getByTestId('create-vault'));

    expect(rendered.getPathname()).toBe('/new');
  });

  it('repaints dark when the system turns dark while it follows the system', async () => {
    const device = aDevice();
    await renderApp(ROUTES, { device });

    await act(() => device.theme.setSystemDark(true));

    expect(screen.getByTestId('start')).toHaveStyle({ backgroundColor: NATIVE_PALETTES.dark.bg });
  });

  it('keeps the chosen light theme on a dark system', async () => {
    const device = aDevice();
    device.theme.setSystemDark(true);
    await renderApp(ROUTES, { device });

    await fireEvent.press(screen.getByTestId('start-appearance'));
    await fireEvent.press(screen.getByTestId('theme-light'));

    expect(device.theme.stored()).toBe('light');
    expect(screen.getByTestId('start')).toHaveStyle({ backgroundColor: NATIVE_PALETTES.light.bg });
    expect(screen.getByTestId('theme-light')).toBeChecked();
  });

  it('goes back to the unlock of the vault a lock just closed', async () => {
    const device = aDevice();
    const maker = device.startStore();
    maker.create('Family', TEST_PASSWORD);
    await when(() => maker.session !== null);
    const vaultKey = maker.session?.vaultKey ?? '';
    maker.lock('manual');

    const rendered = await renderApp(ROUTES, { device, launch: { locked: vaultKey } });
    await act(() => rendered.app.registry.refresh());

    await waitFor(() => expect(rendered.getPathname()).toBe(`/${vaultKey}`));
  });

  it('deletes a vault from this phone only once the deletion is confirmed', async () => {
    const device = aDevice();
    const maker = device.startStore();
    maker.create('Family', TEST_PASSWORD);
    await when(() => maker.session !== null);
    maker.lock('manual');
    const rendered = await renderApp(ROUTES, { device });
    await act(() => rendered.app.registry.refresh());

    await fireEvent.press(screen.getByTestId('vault-delete'));
    await fireEvent.press(screen.getByTestId('dialog-close'));
    const keptAfterClose = screen.queryAllByTestId('vault-row').length;
    await fireEvent.press(screen.getByTestId('vault-delete'));
    await fireEvent.press(screen.getByTestId('confirm-delete-vault'));

    expect(keptAfterClose).toBe(1);
    expect(await screen.findByTestId('no-vaults')).toBeOnTheScreen();
  });

  it('opens at launch on the vault opened last, and stays on the list when it is visited later', async () => {
    const device = aDevice();
    const maker = device.startStore();
    maker.create('Family', TEST_PASSWORD);
    await when(() => maker.session !== null);
    const vaultKey = maker.session?.vaultKey ?? '';
    maker.lock('manual');
    await act(() => maker.registry.refresh());
    await when(() => maker.registry.vaults.value?.[0]?.lastOpenedAt !== null);

    const rendered = await renderApp(ROUTES, { device, launch: { locked: null } });
    await act(() => rendered.app.registry.refresh());

    await waitFor(() => expect(rendered.getPathname()).toBe(`/${vaultKey}`));
    await act(() => router.back());
    await act(() => rendered.app.registry.refresh());

    expect(rendered.getPathname()).toBe('/');
  });
});
