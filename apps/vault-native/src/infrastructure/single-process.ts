import type { TAcquireLeadership } from '@frozik/vault-app/session/domain/ports/leadership';
import type { ITabChannel } from '@frozik/vault-app/session/domain/ports/tab-channel';

/** The app runs in one process: it leads the sync of every vault it opens at once. */
export const SOLE_LEADERSHIP: TAcquireLeadership = (_vaultKey, onLeader) => {
  onLeader();
  return () => undefined;
};

/** No other tab to tell: what the session posts reaches no one. */
export function openLoneTabChannel(): ITabChannel {
  return {
    post: () => undefined,
    onMessage: () => () => undefined,
    close: () => undefined,
  };
}
