import { assert } from '@frozik/utils/assert/assert';
import type { Milliseconds } from '@frozik/utils/date/types';
import { fireEvent, render, screen } from '@testing-library/react';

import { QuickUnlockScreen } from './QuickUnlockScreen';

const VAULT = {
  vaultKey: 'a1b2',
  name: 'Home',
  description: '',
  lastOpenedAt: 0 as Milliseconds,
  unsyncedChanges: false,
};

function aScreen(kind: 'first-four' | 'pattern', answer: 'too-short' | null = null) {
  const attempts: (string | readonly number[])[] = [];
  const onUseMaster = vi.fn();
  const onLockCompletely = vi.fn();
  render(
    <QuickUnlockScreen
      vault={VAULT}
      quick={{
        attempt: entry => {
          attempts.push(entry);
          return answer;
        },
      }}
      prompt={kind === 'pattern' ? { kind, hideLine: false } : { kind }}
      unlocking={false}
      onUseMaster={onUseMaster}
      onLockCompletely={onLockCompletely}
    />
  );
  return { attempts, onUseMaster, onLockCompletely };
}

describe('the quick lock screen', () => {
  it('locks completely on request, leaving no code behind', () => {
    const { onLockCompletely } = aScreen('first-four');

    fireEvent.click(screen.getByTestId('lock-completely'));

    expect(onLockCompletely).toHaveBeenCalledOnce();
  });

  it('sends the four characters typed, on Enter', () => {
    const { attempts } = aScreen('first-four');
    const field = screen.getByTestId('quick-unlock').querySelector('input');
    assert(field !== null);

    fireEvent.change(field, { target: { value: 'corr' } });
    fireEvent.keyDown(field, { key: 'Enter' });

    expect(attempts).toEqual(['corr']);
  });

  it('says why a drawing was no code, without spending the try', () => {
    aScreen('pattern', 'too-short');
    const [point] = screen.getByTestId('pattern-pad').querySelectorAll('button');
    assert(point !== undefined);

    fireEvent.keyDown(point, { key: ' ' });
    fireEvent.keyDown(point, { key: 'Enter' });

    expect(screen.getByRole('alert').dataset.state).toBe('too-short');
  });

  it('always offers the master password instead', () => {
    const { onUseMaster } = aScreen('first-four');

    fireEvent.click(screen.getByTestId('use-master-password'));

    expect(onUseMaster).toHaveBeenCalled();
  });
});
