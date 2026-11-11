import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { chooseCloud } from '../testing/choose-cloud';
import { openSettingsTopic } from '../testing/settings-topic';
import { unlockedVaultWith } from '../testing/unlocked-vault';

describe('the cloud of the open vault on the phone', () => {
  it('keeps the vault in a Drive folder after the Google sign-in and syncs it there', async () => {
    const { app } = await unlockedVaultWith([], { googleDrive: 'signs-in' });
    await openSettingsTopic('cloud');

    await chooseCloud('drive:my-drive');
    await fireEvent.changeText(screen.getByTestId('drive-folder'), 'Passwords');
    await fireEvent.press(screen.getByTestId('drive-sign-in'));
    await fireEvent.press(await screen.findByTestId('keep-here'));

    expect(await screen.findByTestId('cloud-location')).toBeOnTheScreen();
    await waitFor(() => expect(app.session?.cloud.status.kind).toBe('synced'));
    expect(app.session?.cloud.connection?.location).toEqual(
      expect.objectContaining({
        kind: 'google-drive',
        space: 'my-drive',
        path: 'Passwords/Family.pwv',
      })
    );
  });

  it('keeps the vault in the app’s hidden Drive folder', async () => {
    const { app } = await unlockedVaultWith([], { googleDrive: 'signs-in' });
    await openSettingsTopic('cloud');

    await chooseCloud('drive:app-data');
    await fireEvent.press(screen.getByTestId('drive-sign-in'));
    await fireEvent.press(await screen.findByTestId('keep-here'));

    await waitFor(() => expect(app.session?.cloud.status.kind).toBe('synced'));
    expect(app.session?.cloud.connection?.location).toEqual(
      expect.objectContaining({ kind: 'google-drive', space: 'app-data' })
    );
  });

  it('shows a known WebDAV service’s fields with its address filled in, and none of Google’s', async () => {
    await unlockedVaultWith([]);
    await openSettingsTopic('cloud');

    await chooseCloud('webdav:yandex');

    expect({
      address: screen.getByTestId('webdav-address').props.value,
      google: screen.queryAllByTestId('drive-sign-in').length,
    }).toEqual({ address: 'https://webdav.yandex.ru/', google: 0 });
  });
});
