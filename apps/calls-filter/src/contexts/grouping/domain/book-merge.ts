import type { Temporal } from 'temporal-polyfill';

import type { TGroup } from './group';
import type { GroupBook } from './group-book';
import { groupBook } from './group-book';
import type { TMember } from './member';
import { sameValue } from './same-value';

interface IVersioned {
  readonly id: string;
  readonly updatedAt: Temporal.Instant;
}

/**
 * One value from three: what this phone has, what the cloud has, and what both had at the
 * last sync. A side that did not change gives way to the side that did; when both changed,
 * the newer edit wins.
 */
function pick<T>(base: T | undefined, local: T, remote: T, localIsNewer: boolean): T {
  if (sameValue(local, remote)) {
    return local;
  }
  if (base !== undefined && sameValue(local, base)) {
    return remote;
  }
  if (base !== undefined && sameValue(remote, base)) {
    return local;
  }
  return localIsNewer ? local : remote;
}

const newer = (left: IVersioned, right: IVersioned) =>
  left.updatedAt.epochMilliseconds >= right.updatedAt.epochMilliseconds;

/**
 * Entities by id, three ways. Present on both sides: merged. On one side only: added there
 * when the base lacks it; deleted on the other side when the base has it — unless the
 * remaining side edited it since, then the edit wins over the delete and nothing is lost.
 * The cloud's order comes first, so every phone ends up listing things the same way.
 */
function mergeById<T extends IVersioned>(
  base: readonly T[],
  local: readonly T[],
  remote: readonly T[],
  both: (base: T | undefined, local: T, remote: T) => T
): readonly T[] {
  const baseOf = new Map(base.map(item => [item.id, item]));
  const localOf = new Map(local.map(item => [item.id, item]));
  const remoteIds = new Set(remote.map(item => item.id));
  const kept = (only: T): boolean => {
    const before = baseOf.get(only.id);
    return before === undefined || !sameValue(before, only);
  };
  return [
    ...remote.flatMap(item => {
      const mine = localOf.get(item.id);
      if (mine !== undefined) {
        return [both(baseOf.get(item.id), mine, item)];
      }
      return kept(item) ? [item] : [];
    }),
    ...local.filter(item => !remoteIds.has(item.id) && kept(item)),
  ];
}

function mergeMembers(
  base: readonly TMember[],
  local: readonly TMember[],
  remote: readonly TMember[]
): readonly TMember[] {
  return mergeById(base, local, remote, (before, mine, theirs) =>
    pick(before, mine, theirs, newer(mine, theirs))
  );
}

/** What every kind of group carries, merged field by field. */
function mergeShared<T extends TGroup>(base: T | undefined, local: T, remote: T): T {
  const localIsNewer = newer(local, remote);
  return {
    ...local,
    color: pick(base?.color, local.color, remote.color, localIsNewer),
    policy: pick(base?.policy, local.policy, remote.policy, localIsNewer),
    temporary: pick(base?.temporary, local.temporary, remote.temporary, localIsNewer),
    autoReply: pick(base?.autoReply, local.autoReply, remote.autoReply, localIsNewer),
    updatedAt: localIsNewer ? local.updatedAt : remote.updatedAt,
  };
}

function mergeGroup(base: TGroup | undefined, local: TGroup, remote: TGroup): TGroup {
  const localIsNewer = newer(local, remote);
  if (local.kind === 'custom' && remote.kind === 'custom') {
    const before = base?.kind === 'custom' ? base : undefined;
    return {
      ...mergeShared(before, local, remote),
      name: pick(before?.name, local.name, remote.name, localIsNewer),
      excludeMyContacts: pick(
        before?.excludeMyContacts,
        local.excludeMyContacts,
        remote.excludeMyContacts,
        localIsNewer
      ),
      include: mergeMembers(before?.include ?? [], local.include, remote.include),
      exclude: mergeMembers(before?.exclude ?? [], local.exclude, remote.exclude),
    };
  }
  if (local.kind === 'my-contacts' && remote.kind === 'my-contacts') {
    const before = base?.kind === 'my-contacts' ? base : undefined;
    return {
      ...mergeShared(before, local, remote),
      exclude: mergeMembers(before?.exclude ?? [], local.exclude, remote.exclude),
    };
  }
  if (local.kind === 'strangers' && remote.kind === 'strangers') {
    return mergeShared(base?.kind === 'strangers' ? base : undefined, local, remote);
  }
  return localIsNewer ? local : remote;
}

/**
 * This phone's book and the cloud's, merged against the copy both had at the last sync.
 * Without a base (the first sync of this phone) everything on either side counts as added.
 */
export function mergeBooks(base: GroupBook | null, local: GroupBook, remote: GroupBook): GroupBook {
  return groupBook(mergeById(base?.groups ?? [], local.groups, remote.groups, mergeGroup));
}
