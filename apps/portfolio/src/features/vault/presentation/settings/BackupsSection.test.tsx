import { assert } from '@frozik/utils/assert/assert';
import { aCard } from '@frozik/vault/testing/builders';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { when } from 'mobx';

import { aDevice, TEST_PASSWORD } from '../../application/fake-device.test-helper';
import { BackupsSection } from './BackupsSection';

async function aSessionWithBackup() {
  const store = aDevice().startStore();
  store.create('Home', TEST_PASSWORD);
  await when(() => store.session !== null);
  const session = store.session;
  assert(session !== null);
  await when(() => session.local.state.phase.kind === 'idle');
  await session.backups.keep('periodic');
  const later = aCard({ title: 'Made later' });
  session.apply(document => ({
    ...document,
    cards: new Map([...document.cards, [later.id, later]]),
  }));
  await when(() => session.local.state.phase.kind === 'idle');
  return { session, later };
}

describe('BackupsSection', () => {
  it('rolls the vault back to a listed backup only after asking, and says what changed', async () => {
    const { session, later } = await aSessionWithBackup();
    render(<BackupsSection session={session} />);
    const [rollBack] = await screen.findAllByRole('button', { name: 'Roll back' });
    assert(rollBack !== undefined);

    fireEvent.click(rollBack);
    expect(session.document.cards.get(later.id)?.trashedAt).toBeNull();
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', { name: 'Roll back' })
      );
    });

    expect(await screen.findByTestId('backup-restored')).toBeTruthy();
    expect(session.document.cards.get(later.id)?.trashedAt).not.toBeNull();
  });
});
