import { setStringAsync } from 'expo-clipboard';
import { fireEvent, screen, waitFor } from 'expo-router/testing-library';

import { TEST_PASSWORD } from '@frozik/vault-app/testing/fake-device';

import { openSettingsTopic } from '../testing/settings-topic';
import { unlockedVaultWith } from '../testing/unlocked-vault';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve(true)) }));

describe('the diagnostics on the phone', () => {
  it('shows what the app did, filters it to the problems, and keeps it as long as chosen', async () => {
    const { diagnostics } = await unlockedVaultWith([]);
    await openSettingsTopic('diagnostics');

    const everything = screen.getAllByTestId('diagnostics-entry-info').length;
    await fireEvent.press(screen.getByTestId('diagnostics-filter'));
    await fireEvent.press(await screen.findByTestId('diagnostics-filter-problems'));
    const noProblems = screen.queryByTestId('diagnostics-empty');
    await fireEvent.press(screen.getByTestId('diagnostics-filter'));
    await fireEvent.press(await screen.findByTestId('diagnostics-filter-unlock'));
    const unlocks = screen.getAllByTestId('diagnostics-entry-info').length;
    await fireEvent.press(screen.getByTestId('diagnostics-term'));
    await fireEvent.press(await screen.findByTestId('diagnostics-term-30'));

    expect({
      everything: everything > unlocks,
      noProblems: noProblems !== null,
      unlocks: unlocks > 0,
      term: diagnostics.term,
    }).toEqual({
      everything: true,
      noProblems: true,
      unlocks: true,
      term: 30,
    });
  });

  it('copies the log with the build and the phone, without the vault’s name or password', async () => {
    await unlockedVaultWith([]);
    await openSettingsTopic('diagnostics');

    await fireEvent.press(screen.getByTestId('diagnostics-copy'));
    await waitFor(() => expect(setStringAsync).toHaveBeenCalled());
    const [copied] = jest.mocked(setStringAsync).mock.calls[0] ?? [''];

    expect({
      header: copied.split('\n')[0]?.startsWith('Ciphra Vault '),
      unlocked: / INFO unlock opened /.test(copied),
      secrets: ['Family', TEST_PASSWORD].filter(secret => copied.includes(secret)),
    }).toEqual({ header: true, unlocked: true, secrets: [] });
  });
});
