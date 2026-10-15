import type { Milliseconds } from '@frozik/utils/date/types';
import type { IKnownVault } from '@frozik/vault/persistence/ports';

import { launchVaultOf } from './launch-vault';

function known(vaultKey: string, lastOpenedAt: number | null): IKnownVault {
  return {
    vaultKey,
    name: vaultKey,
    description: '',
    lastOpenedAt: lastOpenedAt as Milliseconds | null,
    unsyncedChanges: false,
  };
}

describe('the vault the app opens on', () => {
  it('is the one a lock just closed', () => {
    expect(launchVaultOf([known('home', 9), known('work', 1)], 'work')).toBe('work');
  });

  it('is the one opened last when no lock names one, or names one that is gone', () => {
    const vaults = [known('home', 1), known('work', 9), known('new', null)];

    expect([launchVaultOf(vaults, null), launchVaultOf(vaults, 'forgotten')]).toEqual([
      'work',
      'work',
    ]);
  });

  it('is none on a device that never opened a vault', () => {
    expect([launchVaultOf([], null), launchVaultOf([known('new', null)], null)]).toEqual([
      null,
      null,
    ]);
  });
});
