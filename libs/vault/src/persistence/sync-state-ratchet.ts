import { uniq } from 'lodash-es';

import type { ISyncState } from './ports';

/**
 * What guards against rollback only ever rises: two tabs
 * save the same record, and the one that saw less must not lower the bar.
 * Everything else is the newer save's.
 */
export function raisedSyncState(stored: ISyncState, next: ISyncState): ISyncState {
  const newerRevision = next.maxSeenRevision >= stored.maxSeenRevision;
  return {
    ...next,
    maxSeenRevision: Math.max(stored.maxSeenRevision, next.maxSeenRevision),
    maxSeenKeyslotsEpoch: Math.max(stored.maxSeenKeyslotsEpoch, next.maxSeenKeyslotsEpoch),
    cloudKeyslotsEpoch: Math.max(stored.cloudKeyslotsEpoch, next.cloudKeyslotsEpoch),
    hashAtMaxSeen: newerRevision ? next.hashAtMaxSeen : stored.hashAtMaxSeen,
    retiredKeyIds: uniq([...stored.retiredKeyIds, ...next.retiredKeyIds]),
  };
}
