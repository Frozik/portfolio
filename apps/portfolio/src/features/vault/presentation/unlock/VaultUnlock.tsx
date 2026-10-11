import type { TBytes } from '@frozik/vault/crypto/bytes';
import type { TUnlockFailure } from '@frozik/vault/lifecycle/lifecycle-state';
import type { IKnownVault } from '@frozik/vault/persistence/ports';
import { observer } from 'mobx-react-lite';
import { useCallback } from 'react';

import type { VaultFeatureStore } from '../../application/VaultFeatureStore';
import { UnlockScreen } from './UnlockScreen';

/** The unlock screen wired to the store: the password, the recovery key, or a passkey of this device. */
export const VaultUnlock = observer(
  ({
    store,
    vault,
    unlocking,
    failure,
  }: {
    readonly store: VaultFeatureStore;
    readonly vault: IKnownVault;
    readonly unlocking: boolean;
    readonly failure: TUnlockFailure | null;
  }) => {
    const { vaultKey } = vault;
    const load = useCallback(() => store.passkeysOfLocked(vaultKey), [store, vaultKey]);
    const unlock = useCallback(
      (credentialIds: readonly TBytes[]) => store.unlockWithPasskey(vaultKey, credentialIds),
      [store, vaultKey]
    );
    return (
      <UnlockScreen
        vault={vault}
        unlocking={unlocking}
        failure={failure}
        onUnlock={store.unlock}
        onUnlockWithRecoveryKey={store.unlockWithRecoveryKey}
        passkeys={{ load, unlock }}
      />
    );
  }
);
