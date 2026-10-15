import type { TVaultKey } from '@frozik/vault/persistence/ports';

import type { TLifecycleState } from '../../session/domain/lifecycle-state';
import { unlockOptionsOf } from './unlock-options';

const VAULT = 'vault' as TVaultKey;
const WEB = { passkey: true, biometric: false };

describe('the unlock options', () => {
  it('offer the passkey and the credentials behind a full lock', () => {
    const lifecycle: TLifecycleState = {
      kind: 'locked',
      vaultKey: VAULT,
      level: 'full',
      reason: 'idle',
      failure: null,
    };

    expect(unlockOptionsOf(lifecycle, WEB)).toEqual({
      credentials: ['passkey', 'password', 'recovery-key'],
      afterFailedQuickCode: false,
    });
  });

  it('keep what the lock offered while a credential is tried, and say when the quick code failed', () => {
    const from = {
      kind: 'locked',
      vaultKey: VAULT,
      level: 'full',
      reason: 'quick-unlock-failed',
      failure: null,
    } as const;

    expect(
      unlockOptionsOf(
        { kind: 'unlocking', vaultKey: VAULT, pendingLock: null, via: 'credential', from },
        WEB
      )
    ).toEqual({ credentials: ['password', 'recovery-key'], afterFailedQuickCode: true });
  });

  it('offer nothing while nothing is locked', () => {
    expect(unlockOptionsOf({ kind: 'no-vault' }, WEB)).toBeNull();
  });
});
