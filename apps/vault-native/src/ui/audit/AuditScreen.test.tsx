import { aCardWith, aField } from '@frozik/vault/testing/builders';
import { fireEvent, screen, waitFor, within } from 'expo-router/testing-library';

import { unlockedVaultWith } from '../testing/unlocked-vault';

const WEAK = aCardWith(
  [aField({ kind: 'password', rotateEveryDays: null }, '123456', { sensitive: true })],
  { title: 'Weak' }
);
const ALSO_WEAK = aCardWith(
  [aField({ kind: 'password', rotateEveryDays: null }, 'qwerty', { sensitive: true })],
  { title: 'Also weak' }
);

describe('the audit', () => {
  it('shows a found problem as a group with its count and its cards', async () => {
    await unlockedVaultWith([WEAK, ALSO_WEAK]);

    await fireEvent.press(screen.getByTestId('tab-audit'));
    const weak = await screen.findByTestId('audit-weak');

    await waitFor(() => expect(within(weak).getAllByTestId('audit-card')).toHaveLength(2));
    expect(within(screen.getByTestId('audit-weak-count')).getByRole('text').props.children).toBe(2);
  });

  it('opens a card from its group', async () => {
    await unlockedVaultWith([WEAK]);
    await fireEvent.press(screen.getByTestId('tab-audit'));

    await fireEvent.press(
      within(await screen.findByTestId('audit-weak')).getByTestId('audit-card')
    );

    expect(await screen.findByTestId('card')).toBeOnTheScreen();
  });
});

describe('the sections sheet beside the audit', () => {
  it('leaves what the audit finds to the Audit tab, and keeps protected cards among the sections', async () => {
    await unlockedVaultWith([{ ...WEAK, protected: true }]);
    await screen.findByTestId('tab-audit-count');

    await fireEvent.press(screen.getByTestId('open-sections'));

    const sheet = screen.getByTestId('section-sheet');
    expect({
      problems: within(sheet).queryByTestId('section-problems'),
      protected: within(screen.getByTestId('section-block-sections')).queryByTestId(
        'section-protected'
      ),
    }).toEqual({ problems: null, protected: expect.anything() });
  });
});
