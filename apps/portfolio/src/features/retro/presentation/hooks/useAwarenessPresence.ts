import { reaction } from 'mobx';
import { useEffect } from 'react';

import type { IdentityStore } from '../../application/IdentityStore';
import type { RoomStore } from '../../application/RoomStore';

/**
 * Keeps `RoomStore` synced with the latest identity snapshot. On every
 * change to the user's `name` or `color`, we call `updateIdentity` which:
 *   1. replaces the cached identity so Yjs mutations use the fresh name,
 *   2. republishes awareness so other peers see the rename immediately,
 *   3. mirrors the new display name into `meta.facilitatorName` when this
 *      client is the facilitator.
 */
export function useAwarenessPresence(roomStore: RoomStore, identityStore: IdentityStore): void {
  useEffect(() => {
    const dispose = reaction(
      () => identityStore.identity,
      identity => roomStore.updateIdentity(identity),
      { fireImmediately: true }
    );
    return dispose;
  }, [roomStore, identityStore]);
}
