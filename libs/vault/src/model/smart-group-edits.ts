import { isNil } from 'lodash-es';

import type { IRandom } from '../ports/random';
import type { IHlc } from './hlc';
import type { TGroupId } from './ids';
import { newSmartGroupId } from './ids';
import type { TSmartGroupRule } from './smart-group-rule';
import type { IVaultDocument } from './vault-document';

/** A smart group of the user's own, named and ruled. */
export function createSmartGroup(
  document: IVaultDocument,
  name: string,
  rule: TSmartGroupRule,
  at: IHlc,
  random: IRandom
): { readonly document: IVaultDocument; readonly groupId: TGroupId } {
  const id = newSmartGroupId(random);
  return {
    groupId: id,
    document: {
      ...document,
      smartGroups: new Map(document.smartGroups).set(id, {
        id,
        name: name.trim(),
        rule,
        updatedAt: at,
      }),
    },
  };
}

/** The name and the rule change together: one last-writer-wins unit, as the group itself is. */
export function updateSmartGroup(
  document: IVaultDocument,
  id: TGroupId,
  change: { readonly name: string; readonly rule: TSmartGroupRule },
  at: IHlc
): IVaultDocument {
  const group = document.smartGroups.get(id);
  return isNil(group)
    ? document
    : {
        ...document,
        smartGroups: new Map(document.smartGroups).set(id, {
          ...group,
          name: change.name.trim(),
          rule: change.rule,
          updatedAt: at,
        }),
      };
}

export function deleteSmartGroup(document: IVaultDocument, id: TGroupId, at: IHlc): IVaultDocument {
  if (!document.smartGroups.has(id)) {
    return document;
  }
  const smartGroups = new Map(document.smartGroups);
  smartGroups.delete(id);
  return {
    ...document,
    smartGroups,
    tombstones: new Map(document.tombstones).set(`group:${id}`, at),
  };
}
