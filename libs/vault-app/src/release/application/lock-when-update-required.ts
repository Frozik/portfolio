import { isNil } from 'lodash-es';
import { reaction } from 'mobx';

import type { TLifecycleState, TLockReason } from '../../session/domain/lifecycle-state';
import { isFullyLocked } from '../../session/domain/lifecycle-state';
import type { UpdateWatch } from './UpdateWatch';

/**
 * A build below the security floor keeps no vault open: whatever opens while
 * the floor holds — an unlock, a new vault — locks fully at once, and the
 * client then brings the new build.
 */
export function lockWhenUpdateRequired(
  watch: UpdateWatch,
  app: { readonly lifecycle: TLifecycleState; readonly lock: (reason: TLockReason) => void }
): () => void {
  // Every state while the floor holds: a lock asked while a new vault is being created is
  // not taken, so the state that follows is asked again.
  return reaction(
    () => (watch.verdict === 'required' ? app.lifecycle : null),
    state => {
      if (!isNil(state) && !isFullyLocked(state)) {
        app.lock('update-required');
      }
    },
    { fireImmediately: true }
  );
}
