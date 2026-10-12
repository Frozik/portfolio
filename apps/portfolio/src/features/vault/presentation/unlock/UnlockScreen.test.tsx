import type { Milliseconds } from '@frozik/utils/date/types';
import type { IKnownVault, TVaultKey } from '@frozik/vault/persistence/ports';
import { fireEvent, render, screen } from '@testing-library/react';

import { formatRecoveryKey, generateRecoveryKey } from '@frozik/vault/crypto/recovery-key';
import { createSeededRandom } from '@frozik/vault/testing/seeded-random';

import { UnlockScreen } from './UnlockScreen';

const VAULT: IKnownVault = {
  vaultKey: 'abc' as TVaultKey,
  name: 'Home',
  description: '',
  lastOpenedAt: 1 as Milliseconds,
  unsyncedChanges: false,
};

const NO_PASSKEYS = { load: () => Promise.resolve([]), unlock: () => Promise.resolve(null) };

const passwordField = (): HTMLInputElement => screen.getByLabelText('Master password');

describe('UnlockScreen', () => {
  it('unlocks with Enter, lets go of the password and offers it to the browser under the vault name', () => {
    const onUnlock = vi.fn();
    const { container } = render(
      <UnlockScreen
        vault={VAULT}
        unlocking={false}
        failure={null}
        onUnlock={onUnlock}
        onUnlockWithRecoveryKey={vi.fn()}
        passkeys={NO_PASSKEYS}
      />
    );

    fireEvent.change(passwordField(), { target: { value: 'correct horse' } });
    fireEvent.keyDown(passwordField(), { key: 'Enter' });

    expect(onUnlock).toHaveBeenCalledWith('correct horse');
    expect(passwordField().value).toBe('');
    expect(passwordField().getAttribute('autocomplete')).toBe('current-password');
    expect(container.querySelector('input[autocomplete="username"]')?.getAttribute('value')).toBe(
      'Home'
    );
  });

  it('says the password was wrong and marks the field', () => {
    render(
      <UnlockScreen
        vault={VAULT}
        unlocking={false}
        failure="wrong-password"
        onUnlock={vi.fn()}
        onUnlockWithRecoveryKey={vi.fn()}
        passkeys={NO_PASSKEYS}
      />
    );

    expect(screen.getByText('Wrong password.')).toBeTruthy();
    expect(passwordField().getAttribute('aria-invalid')).toBe('true');
  });

  it('takes no second attempt while the key is being derived', () => {
    const onUnlock = vi.fn();
    render(
      <UnlockScreen
        vault={VAULT}
        unlocking
        failure={null}
        onUnlock={onUnlock}
        onUnlockWithRecoveryKey={vi.fn()}
        passkeys={NO_PASSKEYS}
      />
    );

    fireEvent.keyDown(passwordField(), { key: 'Enter' });

    expect(onUnlock).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Unlock' })).toHaveProperty('disabled', true);
  });

  it('opens with the recovery key, telling a typo from a wrong key', () => {
    const onKey = vi.fn();
    const key = formatRecoveryKey(generateRecoveryKey(createSeededRandom(4)));
    const typo = `${key.slice(0, -1)}${key.endsWith('0') ? '1' : '0'}`;
    render(
      <UnlockScreen
        vault={VAULT}
        unlocking={false}
        failure={null}
        onUnlock={vi.fn()}
        onUnlockWithRecoveryKey={onKey}
        passkeys={NO_PASSKEYS}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: /recovery key/ }));
    const field = screen.getByLabelText('Recovery key');

    fireEvent.change(field, { target: { value: typo } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(screen.getByText('There is a typo in the recovery key.')).toBeTruthy();
    fireEvent.change(field, { target: { value: key.toLowerCase() } });
    fireEvent.keyDown(field, { key: 'Enter' });

    expect(onKey).toHaveBeenCalledTimes(1);
    expect(onKey.mock.calls[0]?.[0]).toBeInstanceOf(Uint8Array);
  });
});
