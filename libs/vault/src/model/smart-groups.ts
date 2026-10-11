import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';

import type { ICardState, TFieldKind } from './card';
import { allFields } from './card';
import type { TExpiryStatus } from './expiry';
import type { TGroupId, TTemplateId } from './ids';
import type { TSmartGroupRule } from './smart-group-rule';

/** What a rule needs beyond the card, computed once per card by the caller. */
export interface IRuleFacts {
  readonly expiry: TExpiryStatus;
  /** Memberships without groups deleted since. */
  readonly groupIds: readonly TGroupId[];
  readonly auditProblem: boolean;
  readonly possibleDuplicate: boolean;
}

function hasField(card: ICardState, fieldKind: TFieldKind, value: string | undefined): boolean {
  return allFields(card).some(
    field =>
      field.spec.kind === fieldKind &&
      (isNil(value) ||
        (field.value.cardinality === 'single'
          ? field.value.value === value
          : field.value.values.includes(value)))
  );
}

export function evaluateRule(rule: TSmartGroupRule, card: ICardState, facts: IRuleFacts): boolean {
  switch (rule.kind) {
    case 'expiry':
      return facts.expiry === rule.status;
    case 'template':
      return rule.templateIds.includes(card.templateId);
    case 'has-field':
      return hasField(card, rule.fieldKind, rule.value);
    case 'in-group':
      return facts.groupIds.includes(rule.groupId);
    case 'favorite':
      return card.favorite;
    case 'trashed':
      return !isNil(card.trashedAt);
    case 'archived':
      return !isNil(card.archivedAt);
    case 'protected':
      return card.protected;
    case 'no-group':
      return facts.groupIds.length === 0;
    case 'audit-problem':
      return facts.auditProblem;
    case 'possible-duplicate':
      return facts.possibleDuplicate;
    case 'all':
      return rule.rules.every(inner => evaluateRule(inner, card, facts));
    case 'any':
      return rule.rules.some(inner => evaluateRule(inner, card, facts));
    case 'not':
      return !evaluateRule(rule.rule, card, facts);
    default:
      return assertNever(rule);
  }
}

/** Neither archived nor in the trash: what "All" and every other group but those two show. */
export const ACTIVE: TSmartGroupRule = {
  kind: 'all',
  rules: [
    { kind: 'not', rule: { kind: 'trashed' } },
    { kind: 'not', rule: { kind: 'archived' } },
  ],
};

function active(rule: TSmartGroupRule): TSmartGroupRule {
  return { kind: 'all', rules: [ACTIVE, rule] };
}

function mentionsArchiveOrTrash(rule: TSmartGroupRule): boolean {
  switch (rule.kind) {
    case 'trashed':
    case 'archived':
      return true;
    case 'all':
    case 'any':
      return rule.rules.some(mentionsArchiveOrTrash);
    case 'not':
      return mentionsArchiveOrTrash(rule.rule);
    default:
      return false;
  }
}

/**
 * What a user's smart group matches: active cards, as every
 * group but Archive and Trash shows, unless its rule asks about those itself.
 */
export function scopedRule(rule: TSmartGroupRule): TSmartGroupRule {
  return mentionsArchiveOrTrash(rule) ? rule : active(rule);
}

/** The built-in smart groups of the MVP, in the order the sidebar lists them. */
export const BUILTIN_SMART_GROUPS = {
  all: ACTIVE,
  favorites: active({ kind: 'favorite' }),
  expiring: active({ kind: 'expiry', status: 'soon' }),
  expired: active({ kind: 'expiry', status: 'expired' }),
  'bank-cards': active({ kind: 'template', templateIds: ['bank-card' as TTemplateId] }),
  'with-otp': active({ kind: 'has-field', fieldKind: 'otp' }),
  'no-group': active({ kind: 'no-group' }),
  problems: active({ kind: 'audit-problem' }),
  duplicates: active({ kind: 'possible-duplicate' }),
  protected: active({ kind: 'protected' }),
  archive: {
    kind: 'all',
    rules: [{ kind: 'archived' }, { kind: 'not', rule: { kind: 'trashed' } }],
  },
  trash: { kind: 'trashed' },
} as const satisfies Record<string, TSmartGroupRule>;

export type TBuiltinGroupId = keyof typeof BUILTIN_SMART_GROUPS;

export const BUILTIN_GROUP_IDS = Object.keys(BUILTIN_SMART_GROUPS) as readonly TBuiltinGroupId[];

/** What the sidebar selects: a built-in smart group or a user group. */
export type TGroupSelection = TBuiltinGroupId | TGroupId;
