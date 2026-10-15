import { whenUpdatesAreDue } from '@frozik/utils/service-worker/updates-due';
import { isNil } from 'lodash-es';
import { reaction } from 'mobx';

import { lockWhenUpdateRequired } from '@frozik/vault-app/release/application/lock-when-update-required';
import type { UpdateWatch } from '@frozik/vault-app/release/application/UpdateWatch';
import type { VaultApp } from '@frozik/vault-app/session/application/VaultApp';
import { isFullyLocked } from '@frozik/vault-app/session/domain/lifecycle-state';
import { registerServiceWorker } from '@frozik/vault-browser/release/service-worker-updates';
import { PAGE_RELOAD_WIPE } from '@frozik/vault-browser/session/page-reload-wipe';

const SERVICE_WORKER_URL = '/sw.js';
const UPDATE_CHECK_INTERVAL_MS = 10 * 60 * 1000;

/**
 * New builds and the security floor: a waiting build takes over only while
 * the app holds no key; a build below the floor locks the vault fully and
 * asks for the new worker at once.
 */
export function followUpdates(app: VaultApp, watch: UpdateWatch): () => void {
  const worker = registerServiceWorker(SERVICE_WORKER_URL, () => reloadKeepingTheLock(app));
  const stopActivation = reaction(() => isFullyLocked(app.lifecycle), worker.allowActivation, {
    fireImmediately: true,
  });
  const stopLocking = lockWhenUpdateRequired(watch, app);
  const stopFetchingRequired = reaction(
    () => watch.verdict === 'required',
    required => {
      if (required) {
        worker.check();
      }
    }
  );
  const stopChecks = whenUpdatesAreDue(() => {
    worker.check();
    void watch.check();
  }, UPDATE_CHECK_INTERVAL_MS);
  void watch.check();
  return () => {
    stopActivation();
    stopLocking();
    stopFetchingRequired();
    stopChecks();
    worker.dispose();
  };
}

/** The unlock screen after the new build still says why the vault locked (an update, the user). */
function reloadKeepingTheLock({ lifecycle }: VaultApp): void {
  if (lifecycle.kind === 'locked' && !isNil(lifecycle.reason)) {
    PAGE_RELOAD_WIPE.wipe({ vaultKey: lifecycle.vaultKey, reason: lifecycle.reason });
    return;
  }
  window.location.reload();
}
