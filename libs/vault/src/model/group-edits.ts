import { isNil } from 'lodash-es';

import type { IRandom } from '../ports/random';
import type { IHlc } from './hlc';
import type { TGroupId } from './ids';
import { newGroupId } from './ids';
import type { IUserGroup, IVaultDocument } from './vault-document';

function putGroup(document: IVaultDocument, group: IUserGroup): IVaultDocument {
  return { ...document, groups: new Map(document.groups).set(group.id, group) };
}

export function createGroup(
  document: IVaultDocument,
  name: string,
  at: IHlc,
  random: IRandom
): { readonly document: IVaultDocument; readonly groupId: TGroupId } {
  const order = Math.max(-1, ...[...document.groups.values()].map(group => group.order)) + 1;
  const group: IUserGroup = {
    id: newGroupId(random),
    name,
    icon: null,
    color: null,
    order,
    updatedAt: at,
  };
  return { document: putGroup(document, group), groupId: group.id };
}

export function updateGroup(
  document: IVaultDocument,
  groupId: TGroupId,
  at: IHlc,
  change: Partial<Pick<IUserGroup, 'name' | 'icon' | 'color' | 'order'>>
): IVaultDocument {
  const group = document.groups.get(groupId);
  return isNil(group) ? document : putGroup(document, { ...group, ...change, updatedAt: at });
}

/**
 * A tombstone, and the cards are left alone: their dangling
 * group ids are filtered on read, so deleting a group conflicts with no
 * concurrent card edit.
 */
export function deleteGroup(document: IVaultDocument, groupId: TGroupId, at: IHlc): IVaultDocument {
  if (!document.groups.has(groupId)) {
    return document;
  }
  const groups = new Map(document.groups);
  groups.delete(groupId);
  return {
    ...document,
    groups,
    tombstones: new Map(document.tombstones).set(`group:${groupId}`, at),
  };
}

/** A card's memberships without the groups deleted since. */
export function liveGroupIds(
  document: IVaultDocument,
  groupIds: readonly TGroupId[]
): readonly TGroupId[] {
  return groupIds.every(id => document.groups.has(id))
    ? groupIds
    : groupIds.filter(id => document.groups.has(id));
}
