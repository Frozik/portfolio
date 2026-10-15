import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { when } from 'mobx';

import {
  aCloud,
  aDevice,
  linkedToWebDav,
  TEST_FOLDER,
  TEST_PASSWORD,
} from '@frozik/vault-app/testing/fake-device';

import { AppUnderTest } from '../testing/AppUnderTest';
import { ForeignVaultDialog } from './ForeignVaultDialog';

/** A second "Family" made on another phone is kept in the folder the first one already uses. */
async function foreignInTheFolder() {
  const cloud = aCloud();
  await linkedToWebDav(aDevice({ cloud }));
  const app = aDevice({ cloud, seed: 9 }).startStore();
  app.create('Family', TEST_PASSWORD);
  await when(() => app.session !== null);
  const session = app.session;
  if (session === null) {
    throw new Error('the vault did not open');
  }
  app.cloud.openWebDavForm();
  app.cloud.webDavForm?.setEndpoint(TEST_FOLDER);
  app.cloud.webDavForm?.setUsername('me');
  app.cloud.webDavForm?.setPassword('app-password');
  await app.cloud.webDavForm?.runCheck();
  await app.cloud.keepInWebDav(session);
  await when(() => session.cloud.status.kind === 'stopped');
  return { app, session };
}

describe('another vault in the cloud folder', () => {
  it('is never merged: the phone asks, and replaces the file only when told', async () => {
    const { app, session } = await foreignInTheFolder();
    await render(
      <AppUnderTest app={app}>
        <ForeignVaultDialog session={session} />
      </AppUnderTest>
    );

    await fireEvent.press(screen.getByTestId('foreign-replace'));

    await act(() =>
      when(
        () => session.cloud.status.kind === 'synced' && session.local.state.phase.kind === 'idle'
      )
    );
    expect(screen.queryByTestId('foreign-vault')).toBeNull();
  });
});
