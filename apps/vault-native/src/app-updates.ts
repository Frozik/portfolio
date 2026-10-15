import { lockWhenUpdateRequired } from '@frozik/vault-app/release/application/lock-when-update-required';
import type { UpdateWatch } from '@frozik/vault-app/release/application/UpdateWatch';
import type { VaultApp } from '@frozik/vault-app/session/application/VaultApp';
import type { ILockSignalSource } from '@frozik/vault-app/session/domain/ports/lock-signal-source';

/**
 * The published release and its security floor, read at start and each time
 * the app comes back to the front: a build below the floor locks the vault
 * fully and says the APK must be updated.
 */
export function followUpdates(
  app: VaultApp,
  watch: UpdateWatch,
  signals: ILockSignalSource
): () => void {
  const stopLocking = lockWhenUpdateRequired(watch, app);
  const stopChecks = signals.onConcealed(concealed => {
    if (!concealed) {
      void watch.check();
    }
  });
  void watch.check();
  return () => {
    stopLocking();
    stopChecks();
  };
}
