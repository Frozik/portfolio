import { aCardWith, aField } from '@frozik/vault/testing/builders';
import { CHROME_CSV } from '@frozik/vault/testing/import-fixtures';
import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { unlockedVaultWith } from '../testing/unlocked-vault';

const mockPicked: { file: { name: string; type: string; bytes: Uint8Array<ArrayBuffer> } | null } =
  { file: null };

jest.mock('../../device-files/pick-files', () => ({
  pickOneFile: () => Promise.resolve(mockPicked.file),
  pickFiles: () => Promise.resolve(mockPicked.file === null ? [] : [mockPicked.file]),
}));

const card = (title: string, password: string) =>
  aCardWith(
    [
      aField({ kind: 'login' }, 'jane'),
      aField({ kind: 'password', rotateEveryDays: null }, password, { sensitive: true }),
    ],
    { title }
  );

async function openTab(tab: 'settings' | 'audit') {
  await fireEvent.press(screen.getByTestId(`tab-${tab}`));
  await screen.findByTestId(tab);
}

describe('the audit on the phone', () => {
  it('lists the cards that share a password', async () => {
    await unlockedVaultWith([card('Bank', 'same-password-1'), card('Mail', 'same-password-1')]);

    await openTab('audit');

    expect(await screen.findByTestId('audit-reused')).toBeOnTheScreen();
  });
});

describe('import and export on the phone', () => {
  it('reads a Chrome export, previews it and adds its logins', async () => {
    const { app } = await unlockedVaultWith([]);
    mockPicked.file = {
      name: 'Chrome Passwords.csv',
      type: 'text/csv',
      bytes: new TextEncoder().encode(CHROME_CSV),
    };
    await openTab('settings');

    await fireEvent.press(screen.getByTestId('import-choose'));
    await fireEvent.press(await screen.findByTestId('import-confirm'));

    expect(await screen.findByTestId('import-done')).toBeOnTheScreen();
    expect(app.session?.document.cards.size).toBeGreaterThan(0);
  });

  it('hands an encrypted copy with its own password to the share sheet', async () => {
    const { device } = await unlockedVaultWith([card('Bank', 'hunter2')]);
    await openTab('settings');

    await fireEvent.changeText(screen.getByTestId('export-password'), 'another long password');
    await fireEvent.changeText(screen.getByTestId('export-confirmation'), 'another long password');
    await fireEvent.press(screen.getByTestId('export-prepare'));
    await fireEvent.press(await screen.findByTestId('export-save'));

    await waitFor(() =>
      expect(device.saved.map(file => file.mime)).toEqual(['application/octet-stream'])
    );
  });
});
