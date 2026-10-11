import { isNil, uniq } from 'lodash-es';

import type { ISyncGuard } from './sync-state';

/**
 * One device record behind two engines (the local copy and
 * the cloud): whatever either has seen stays seen, so a save by the one that
 * saw less never lowers the bar.
 */
export function guardUnion(first: ISyncGuard, second: ISyncGuard): ISyncGuard {
  const [newer, older] =
    second.maxSeenRevision > first.maxSeenRevision ? [second, first] : [first, second];
  const sameRevision = newer.maxSeenRevision === older.maxSeenRevision;
  return {
    ...newer,
    maxSeenKeyslotsEpoch: Math.max(first.maxSeenKeyslotsEpoch, second.maxSeenKeyslotsEpoch),
    retiredKeyIds: uniq([...first.retiredKeyIds, ...second.retiredKeyIds]),
    hashAtMaxSeen:
      sameRevision && isNil(newer.hashAtMaxSeen) ? older.hashAtMaxSeen : newer.hashAtMaxSeen,
  };
}
