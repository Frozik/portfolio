import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';

import type { TFieldKind } from './card';
import type { TGroupId, TTemplateId } from './ids';
import type { TSmartGroupRule } from './smart-group-rule';

/** One condition of the builder: any rule that is not a combination of others. */
export type TConditionRule = Exclude<TSmartGroupRule, { readonly kind: 'all' | 'any' | 'not' }>;

export type TConditionKind = TConditionRule['kind'];

export type TMatchMode = 'all' | 'any';

export interface ISmartGroupCondition {
  readonly negated: boolean;
  readonly rule: TConditionRule;
}

/** The conditions the builder offers, in its menu's order. */
export const CONDITION_KINDS: readonly TConditionKind[] = [
  'favorite',
  'has-field',
  'template',
  'in-group',
  'no-group',
  'expiry',
  'audit-problem',
  'possible-duplicate',
  'protected',
  'archived',
  'trashed',
];

/** What a new condition of a kind starts with: the first choice of each of its parameters. */
export function newCondition(
  kind: TConditionKind,
  firsts: {
    readonly templateId: TTemplateId;
    readonly groupId: TGroupId | null;
    readonly fieldKind: TFieldKind;
  }
): TConditionRule | null {
  switch (kind) {
    case 'expiry':
      return { kind, status: 'soon' };
    case 'template':
      return { kind, templateIds: [firsts.templateId] };
    case 'has-field':
      return { kind, fieldKind: firsts.fieldKind };
    case 'in-group':
      return isNil(firsts.groupId) ? null : { kind, groupId: firsts.groupId };
    case 'favorite':
    case 'trashed':
    case 'archived':
    case 'protected':
    case 'no-group':
    case 'audit-problem':
    case 'possible-duplicate':
      return { kind };
    default:
      return assertNever(kind);
  }
}

/** The builder's flat form as the rule the vault keeps: all or any of the conditions, each maybe negated. */
export function ruleOfConditions(
  mode: TMatchMode,
  conditions: readonly ISmartGroupCondition[]
): TSmartGroupRule {
  return {
    kind: mode,
    rules: conditions.map(({ negated, rule }) => (negated ? { kind: 'not', rule } : rule)),
  };
}

function isCondition(rule: TSmartGroupRule): rule is TConditionRule {
  return rule.kind !== 'all' && rule.kind !== 'any' && rule.kind !== 'not';
}

function conditionOf(rule: TSmartGroupRule): ISmartGroupCondition | null {
  if (isCondition(rule)) {
    return { negated: false, rule };
  }
  return rule.kind === 'not' && isCondition(rule.rule) ? { negated: true, rule: rule.rule } : null;
}

/** A kept rule back in the builder's flat form; `null` for one deeper than the builder makes. */
export function conditionsOfRule(
  rule: TSmartGroupRule
): { readonly mode: TMatchMode; readonly conditions: readonly ISmartGroupCondition[] } | null {
  if (rule.kind !== 'all' && rule.kind !== 'any') {
    const single = conditionOf(rule);
    return isNil(single) ? null : { mode: 'all', conditions: [single] };
  }
  const conditions = rule.rules.map(conditionOf).filter(condition => !isNil(condition));
  return conditions.length === rule.rules.length ? { mode: rule.kind, conditions } : null;
}
