import { aCardWith, aField } from '@frozik/vault/testing/builders';
import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import { openSettingsTopic } from '../testing/settings-topic';
import { unlockedVaultWith } from '../testing/unlocked-vault';

const WEAK = aCardWith(
  [aField({ kind: 'password', rotateEveryDays: null }, '123456', { sensitive: true })],
  { title: 'Weak' }
);

function countOnAuditTab(): unknown {
  return within(screen.getByTestId('tab-audit-count')).getByRole('text').props.children;
}

describe('the Audit tab’s count', () => {
  it('shows how many cards need attention', async () => {
    const { app } = await unlockedVaultWith([WEAK]);

    await waitFor(() => expect(app.session?.audit.problems.size).toBeGreaterThan(0));

    expect(countOnAuditTab()).toBe(app.session?.audit.problems.size);
  });

  it('shows nothing while no card needs attention', async () => {
    await unlockedVaultWith([]);

    expect(screen.queryByTestId('tab-audit-count')).not.toBeOnTheScreen();
  });

  it('goes away once the settings turn it off', async () => {
    await unlockedVaultWith([WEAK]);
    await screen.findByTestId('tab-audit-count');

    await openSettingsTopic('display');
    await fireEvent.press(screen.getByTestId('show-audit-count'));

    expect(screen.queryByTestId('tab-audit-count')).not.toBeOnTheScreen();
  });
});
