import { credentialsOffered } from '@frozik/vault-app/keys/domain/credentials-offered';
import type { TBytes } from '@frozik/vault/crypto/bytes';
import type { IKnownVault } from '@frozik/vault/persistence/ports';
import type { TUnlockFailure } from '@frozik/vault/session/unlock-failure';
import { observer } from 'mobx-react-lite';
import { useCallback } from 'react';

import type { VaultApp } from '@frozik/vault-app/session/application/VaultApp';
import { keysT } from '@frozik/vault-react/texts/keys';
import { UnlockScreen } from './UnlockScreen';

/** The unlock screen wired to the store: the password, the recovery key, or a passkey of this device. */
export const VaultUnlock = observer(
  ({
    store,
    vault,
    unlocking,
    failure,
  }: {
    readonly store: VaultApp;
    readonly vault: IKnownVault;
    readonly unlocking: boolean;
    readonly failure: TUnlockFailure | null;
  }) => {
    const { lifecycle } = store;
    const lock =
      lifecycle.kind === 'locked'
        ? lifecycle
        : lifecycle.kind === 'unlocking'
          ? lifecycle.from
          : { level: 'full' as const, reason: null };
    const offered = credentialsOffered(lock, { passkey: true, biometric: false });
    const { vaultKey } = vault;
    const load = useCallback(async () => {
      const [credentialIds, capabilities] = await Promise.all([
        store.flows.passkeysOfLocked(vaultKey),
        store.flows.passkeyCapabilities(),
      ]);
      return { credentialIds, capabilities };
    }, [store, vaultKey]);
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
        passkeys={offered.includes('passkey') ? { load, unlock } : null}
        notice={lock.reason === 'quick-unlock-failed' ? keysT.quickScreen.failed : null}
      />
    );
  }
);
