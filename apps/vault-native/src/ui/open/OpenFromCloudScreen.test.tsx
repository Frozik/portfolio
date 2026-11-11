import { router } from 'expo-router';
import { act, fireEvent, screen, waitFor } from 'expo-router/testing-library';
import { DeviceEventEmitter, View } from 'react-native';

import {
  aCloud,
  aDevice,
  linkedToWebDav,
  TEST_FOLDER,
} from '@frozik/vault-app/testing/fake-device';

import { chooseCloud } from '../testing/choose-cloud';
import { renderApp } from '../testing/render-app';
import { OpenFromCloudScreen } from './OpenFromCloudScreen';

const ROUTES = {
  index: () => <View testID="start" />,
  'open/index': () => <OpenFromCloudScreen />,
  'open/new': () => <View testID="create-in-cloud" />,
  '[vaultId]': () => <View testID="vault" />,
};

async function reachTheFolder(): Promise<void> {
  await chooseCloud('webdav-custom');
  await fireEvent.changeText(screen.getByTestId('webdav-address'), TEST_FOLDER);
  await fireEvent.changeText(screen.getByTestId('webdav-username'), 'me');
  await fireEvent.changeText(screen.getByTestId('webdav-password'), 'app-password');
  await fireEvent.press(screen.getByTestId('webdav-check'));
}

describe('opening a vault from a WebDAV folder on a second phone', () => {
  it('copies the vault found there to this phone and goes to its unlock', async () => {
    const cloud = aCloud();
    await linkedToWebDav(aDevice({ cloud }));
    const rendered = await renderApp(ROUTES, {
      device: aDevice({ cloud, seed: 9 }),
      initialUrl: '/open',
    });
    await reachTheFolder();

    await fireEvent.press(await screen.findByTestId('open-found-vault'));

    await waitFor(() => expect(screen.getByTestId('vault')).toBeOnTheScreen());
    expect(rendered.getPathname()).toMatch(/^\/[0-9a-f]+$/);
  });

  it('offers a new vault made in an empty folder', async () => {
    const rendered = await renderApp(ROUTES, { initialUrl: '/open' });
    await reachTheFolder();

    await fireEvent.press(await screen.findByTestId('create-here'));

    expect(rendered.getPathname()).toBe('/open/new');
  });

  it('signs in to Google Drive and offers a new vault made in its empty folder', async () => {
    const rendered = await renderApp(ROUTES, {
      device: aDevice({ googleDrive: 'signs-in' }),
      initialUrl: '/open',
    });

    await chooseCloud('drive:my-drive');
    await fireEvent.press(screen.getByTestId('drive-sign-in'));
    await fireEvent.press(await screen.findByTestId('create-here'));

    expect(rendered.getPathname()).toBe('/open/new');
  });

  it('closes to the start when nothing came before it', async () => {
    const rendered = await renderApp(ROUTES, { initialUrl: '/open' });

    await fireEvent.press(screen.getByTestId('close-open-from-cloud'));

    await waitFor(() => expect(rendered.getPathname()).toBe('/'));
  });

  it('steps back from the WebDAV form with the back gesture, staying in the opening', async () => {
    const rendered = await renderApp(ROUTES, { initialUrl: '/' });
    await act(() => router.push('/open'));
    await chooseCloud('webdav-custom');

    await act(() => DeviceEventEmitter.emit('hardwareBackPress'));

    expect({
      path: rendered.getPathname(),
      form: screen.queryAllByTestId('webdav-address').length,
      choosing: screen.queryAllByTestId('cloud-choice').length,
    }).toEqual({
      path: '/open',
      form: 0,
      choosing: 1,
    });
  });
});
