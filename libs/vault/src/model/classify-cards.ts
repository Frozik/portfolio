import { isNil } from 'lodash-es';
import type { Temporal } from 'temporal-polyfill';

import type { IVaultCard } from './card';
import { allFields } from './card';
import { duplicateKeyOf } from './duplicate-key';
import { expiryStatus, warningDaysFor } from './expiry';
import { liveGroupIds } from './group-edits';
import type { TCardId } from './ids';
import type { TBuiltinGroupId, TGroupSelection } from './smart-groups';
import {
  ACTIVE,
  BUILTIN_GROUP_IDS,
  BUILTIN_SMART_GROUPS,
  evaluateRule,
  scopedRule,
} from './smart-groups';
import type { IVaultDocument } from './vault-document';

export interface ICardClassification {
  readonly byGroup: ReadonlyMap<TGroupSelection, readonly IVaultCard[]>;
}

/**
 * Every built-in smart group, every user group and every smart
 * group of the user's in one pass
 * over the cards, so 5 000 cards are read once rather than once per group.
 */
export function classifyCards(
  document: IVaultDocument,
  today: Temporal.PlainDate,
  /** Cards the audit found something about; none until it has run. */
  auditProblems: ReadonlySet<TCardId> = new Set()
): ICardClassification {
  const duplicates = possibleDuplicates(document);
  const byGroup = new Map<TGroupSelection, IVaultCard[]>();
  const add = (group: TGroupSelection, card: IVaultCard): void => {
    const members = byGroup.get(group);
    if (isNil(members)) {
      byGroup.set(group, [card]);
    } else {
      members.push(card);
    }
  };
  const smartRules = [...document.smartGroups.values()].map(
    group => [group.id, scopedRule(group.rule)] as const
  );
  for (const card of document.cards.values()) {
    const groupIds = liveGroupIds(document, card.groupIds);
    const facts = {
      expiry: expiryStatus(card, today, warningDaysFor(card, document.settings)),
      groupIds,
      auditProblem: auditProblems.has(card.id),
      possibleDuplicate: duplicates.has(card.id),
    };
    for (const group of BUILTIN_GROUP_IDS) {
      if (evaluateRule(BUILTIN_SMART_GROUPS[group], card, facts)) {
        add(group, card);
      }
    }
    if (evaluateRule(ACTIVE, card, facts)) {
      groupIds.forEach(groupId => add(groupId, card));
    }
    for (const [groupId, rule] of smartRules) {
      if (evaluateRule(rule, card, facts)) {
        add(groupId, card);
      }
    }
  }
  return { byGroup };
}

/** Cards outside the archive and the trash that share a site and a login with another. */
export function possibleDuplicates(document: IVaultDocument): ReadonlySet<TCardId> {
  const byKey = new Map<string, TCardId[]>();
  for (const card of document.cards.values()) {
    const key =
      isNil(card.archivedAt) && isNil(card.trashedAt) ? duplicateKeyOf(allFields(card)) : null;
    if (!isNil(key)) {
      byKey.set(key, [...(byKey.get(key) ?? []), card.id]);
    }
  }
  return new Set([...byKey.values()].filter(ids => ids.length > 1).flat());
}

export function membersOf(
  classification: ICardClassification,
  group: TGroupSelection
): readonly IVaultCard[] {
  return classification.byGroup.get(group) ?? [];
}

export function isBuiltinGroup(group: TGroupSelection): group is TBuiltinGroupId {
  return group in BUILTIN_SMART_GROUPS;
}
