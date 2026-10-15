import { router } from 'expo-router';
import { act, fireEvent, screen } from 'expo-router/testing-library';
import { when } from 'mobx';

import {
  aCloud,
  aDevice,
  linkedToWebDav,
  TEST_FOLDER,
  TEST_PASSWORD,
} from '@frozik/vault-app/testing/fake-device';

import { OpenFromCloudScreen } from '../open/OpenFromCloudScreen';
import { OPEN_VAULT_ROUTES } from '../testing/open-vault-routes';
import { renderApp } from '../testing/render-app';

const ROUTES = { ...OPEN_VAULT_ROUTES, 'open/index': () => <OpenFromCloudScreen /> };

describe('a vault reached from another vault’s unlock screen', () => {
  it('stays open: the screen left behind does not take the vault back', async () => {
    const cloud = aCloud();
    await linkedToWebDav(aDevice({ cloud }));
    const device = aDevice({ cloud, seed: 9 });
    const maker = device.startStore();
    maker.create('Local', TEST_PASSWORD);
    await when(() => maker.session !== null);
    const localKey = maker.session?.vaultKey ?? '';
    maker.lock('manual');
    const rendered = await renderApp(ROUTES, { device, initialUrl: `/${localKey}` });
    await act(() => rendered.app.registry.refresh());
    await screen.findByTestId('unlock-password');

    await act(() => router.push('/open'));
    await fireEvent.press(screen.getByTestId('choose-webdav'));
    await fireEvent.changeText(screen.getByTestId('webdav-address'), TEST_FOLDER);
    await fireEvent.changeText(screen.getByTestId('webdav-username'), 'me');
    await fireEvent.changeText(screen.getByTestId('webdav-password'), 'app-password');
    await fireEvent.press(screen.getByTestId('webdav-check'));
    await fireEvent.press(await screen.findByTestId('open-found-vault'));
    await fireEvent.changeText(await screen.findByTestId('unlock-password'), TEST_PASSWORD);
    await fireEvent.press(screen.getByTestId('unlock-submit'));

    await act(() =>
      when(
        () =>
          rendered.app.session?.cloud.status.kind === 'synced' &&
          rendered.app.session.local.state.phase.kind === 'idle'
      )
    );
    expect(rendered.app.lifecycle.kind).toBe('unlocked');
  });
});
