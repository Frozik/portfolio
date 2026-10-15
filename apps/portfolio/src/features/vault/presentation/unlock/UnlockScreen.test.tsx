import type { Milliseconds } from '@frozik/utils/date/types';
import type { IKnownVault, TVaultKey } from '@frozik/vault/persistence/ports';
import type { RenderResult } from '@testing-library/react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';

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

const NO_PASSKEYS = {
  load: () =>
    Promise.resolve({
      credentialIds: [],
      capabilities: { prf: true, platform: 'passkey' as const },
    }),
  unlock: () => Promise.resolve(null),
};

const passwordField = (): HTMLInputElement => screen.getByLabelText('Master password');

/** The screen once its passkeys have loaded: the list comes in after the first render. */
async function renderLoaded(screenElement: ReactElement): Promise<RenderResult> {
  const rendered = render(screenElement);
  await act(async () => {
    await Promise.resolve();
  });
  return rendered;
}

/** What is wrong with a control, as its description says it: `data-state` of the text it points at. */
function problemOf(control: HTMLElement): string | null {
  const description = document.getElementById(control.getAttribute('aria-describedby') ?? '');
  return description?.getAttribute('data-state') ?? null;
}

describe('UnlockScreen', () => {
  it('unlocks with Enter, keeps the password until it is checked and offers it to the browser under the vault name', async () => {
    const onUnlock = vi.fn();
    const { container } = await renderLoaded(
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
    expect(passwordField().value).toBe('correct horse');
    expect(passwordField().getAttribute('autocomplete')).toBe('current-password');
    expect(container.querySelector('input[autocomplete="username"]')?.getAttribute('value')).toBe(
      'Home'
    );
  });

  it('says the password was wrong and marks the field', async () => {
    await renderLoaded(
      <UnlockScreen
        vault={VAULT}
        unlocking={false}
        failure="wrong-password"
        onUnlock={vi.fn()}
        onUnlockWithRecoveryKey={vi.fn()}
        passkeys={NO_PASSKEYS}
      />
    );

    expect(passwordField().getAttribute('aria-invalid')).toBe('true');
    expect(problemOf(passwordField())).toBe('wrong-password');
  });

  it('takes no second attempt while the key is being derived', async () => {
    const onUnlock = vi.fn();
    await renderLoaded(
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

  it('opens with the recovery key, telling a typo from a wrong key', async () => {
    const onKey = vi.fn();
    const key = formatRecoveryKey(generateRecoveryKey(createSeededRandom(4)));
    const typo = `${key.slice(0, -1)}${key.endsWith('0') ? '1' : '0'}`;
    await renderLoaded(
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
    expect(problemOf(field)).toBe('checksum-mismatch');
    fireEvent.change(field, { target: { value: key.toLowerCase() } });
    fireEvent.keyDown(field, { key: 'Enter' });

    expect(onKey).toHaveBeenCalledTimes(1);
    expect(onKey.mock.calls[0]?.[0]).toBeInstanceOf(Uint8Array);
  });
});
