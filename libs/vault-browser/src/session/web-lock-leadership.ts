import type { TAcquireLeadership } from '@frozik/vault-app/session/domain/ports/leadership';

/** `navigator.locks` without `ifAvailable`: tabs queue, and the lock passes on when its holder closes. */
export const acquireWebLockLeadership: TAcquireLeadership = (vaultKey, onLeader) => {
  const abandoned = new AbortController();
  let release: () => void = () => abandoned.abort();
  void navigator.locks
    .request(`pwv:sync:${vaultKey}`, { signal: abandoned.signal }, () => {
      onLeader();
      return new Promise<void>(resolve => {
        release = resolve;
      });
    })
    .catch(() => undefined);
  return () => release();
};
