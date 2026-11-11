import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { openSettingsTopic } from '../testing/settings-topic';
import { unlockedVaultWith } from '../testing/unlocked-vault';

describe('the backup folder on the phone', () => {
  it('keeps a copy of the vault from the first unlock, as the default week asks', async () => {
    const { device } = await unlockedVaultWith([]);

    await waitFor(() => expect(device.backupFolder.files().size).toBe(1));
  });

  it('makes a copy now, lists the folder, shares one copy and deletes it', async () => {
    const { device } = await unlockedVaultWith([]);
    await waitFor(() => expect(device.backupFolder.files().size).toBe(1));
    await openSettingsTopic('backup');
    device.time.advance(60_000);

    await fireEvent.press(screen.getByTestId('backup-now'));
    await screen.findByTestId('backup-made');
    await fireEvent.press(screen.getByTestId('backup-location'));
    const listed = (await screen.findAllByTestId('backup-file')).length;
    const [newest] = screen.getAllByTestId('backup-file-name');
    const newestName = String(newest?.props.children);
    await fireEvent.press(screen.getAllByTestId('backup-file-share')[0] ?? newest);
    await fireEvent.press(screen.getAllByTestId('backup-file-remove')[0] ?? newest);
    await waitFor(() => expect(screen.getAllByTestId('backup-file')).toHaveLength(1));

    expect({
      listed,
      shared: device.saved.map(file => file.name),
      left: [...device.backupFolder.files().keys()].includes(newestName),
    }).toEqual({ listed: 2, shared: [newestName], left: false });
  });

  it('makes no copy by itself once told never to', async () => {
    const { app, device } = await unlockedVaultWith([]);
    await waitFor(() => expect(device.backupFolder.files().size).toBe(1));
    await openSettingsTopic('backup');

    await fireEvent.press(screen.getByTestId('backup-interval'));
    await fireEvent.press(await screen.findByTestId('backup-interval-never'));

    expect(app.session?.deviceSettings.settings.backupEveryDays).toBeNull();
  });
});
