import type { TVaultKey } from '@frozik/vault/persistence/ports';

import type { TLifecycleState } from './lifecycle-state';
import { isFullyLocked } from './lifecycle-state';

const VAULT = 'vault' as TVaultKey;

describe('a fully locked app', () => {
  it('holds nothing before a vault is chosen or behind a full lock', () => {
    expect(isFullyLocked({ kind: 'no-vault' })).toBe(true);
    expect(
      isFullyLocked({ kind: 'locked', vaultKey: VAULT, level: 'full', reason: null, failure: null })
    ).toBe(true);
  });

  it('still holds a key behind a quick lock, while deriving one or while open', () => {
    const quick: TLifecycleState = {
      kind: 'locked',
      vaultKey: VAULT,
      level: 'quick',
      reason: 'idle',
      failure: null,
    };

    expect(isFullyLocked(quick)).toBe(false);
    expect(isFullyLocked({ kind: 'creating' })).toBe(false);
    expect(
      isFullyLocked({
        kind: 'unlocking',
        vaultKey: VAULT,
        pendingLock: null,
        via: 'credential',
        from: { ...quick, level: 'full' },
      })
    ).toBe(false);
  });
});
