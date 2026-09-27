import { isNil } from 'lodash-es';

export type TJoin = 'and' | 'or';

export type TTextOp =
  | 'contains'
  | 'notContains'
  | 'equals'
  | 'notEquals'
  | 'startsWith'
  | 'endsWith'
  | 'matchesRegex'
  | 'blank'
  | 'notBlank';

export type TNumberOp =
  | 'equals'
  | 'notEquals'
  | 'greaterThan'
  | 'greaterOrEqual'
  | 'lessThan'
  | 'lessOrEqual'
  | 'between'
  | 'blank'
  | 'notBlank';

export type TDateOp =
  | TNumberOp
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'
  | 'last7Days'
  | 'last30Days';

export interface ITextCondition {
  readonly op: TTextOp | string;
  readonly text?: string;
}

export interface INumberCondition {
  readonly op: TNumberOp | string;
  readonly from?: number;
  readonly to?: number;
}

export interface IDateCondition {
  readonly op: TDateOp | string;
  /** ISO 8601: a date, or an instant with `T`. */
  readonly from?: string;
  readonly to?: string;
}

export interface ITextFilterModel {
  readonly kind: 'text';
  readonly join: TJoin;
  readonly conditions: readonly ITextCondition[];
}

export interface INumberFilterModel {
  readonly kind: 'number';
  readonly join: TJoin;
  readonly conditions: readonly INumberCondition[];
}

export interface IDateFilterModel {
  readonly kind: 'date';
  readonly join: TJoin;
  readonly conditions: readonly IDateCondition[];
}

export interface ISetFilterModel {
  readonly kind: 'set';
  readonly values: readonly string[];
}

export interface IEnumFilterModel {
  readonly kind: 'enum';
  readonly value: string;
}

export interface IBooleanFilterModel {
  readonly kind: 'boolean';
  readonly value: boolean;
}

export interface ICustomFilterModel {
  readonly kind: 'custom';
  readonly value: unknown;
}

/** Serializable; the same model drives the client pipeline and a server query. */
export type TFilterModel =
  | ITextFilterModel
  | INumberFilterModel
  | IDateFilterModel
  | ISetFilterModel
  | IEnumFilterModel
  | IBooleanFilterModel
  | ICustomFilterModel;

export type TFilterKind = TFilterModel['kind'];

export type TConditionModel = ITextFilterModel | INumberFilterModel | IDateFilterModel;

export const DEFAULT_MAX_CONDITIONS = 2;

/** Operators that stand on their own, without a value to compare with. */
export const VALUELESS_OPS: ReadonlySet<string> = new Set([
  'blank',
  'notBlank',
  'today',
  'yesterday',
  'thisWeek',
  'lastWeek',
  'thisMonth',
  'lastMonth',
  'thisYear',
  'last7Days',
  'last30Days',
]);

/** Operators an empty cell value still passes; every other operator rejects it. */
export const OPS_ACCEPTING_EMPTY: ReadonlySet<string> = new Set([
  'blank',
  'notBlank',
  'notEquals',
  'notContains',
]);

export const RANGE_OPS: ReadonlySet<string> = new Set(['between']);

export function isBlankValue(value: unknown): boolean {
  return isNil(value) || (typeof value === 'string' && value.trim() === '');
}

export function isConditionComplete(
  condition: ITextCondition | INumberCondition | IDateCondition
): boolean {
  if (VALUELESS_OPS.has(condition.op)) {
    return true;
  }
  if (!('from' in condition) && !('to' in condition)) {
    return 'text' in condition && !isBlankValue(condition.text);
  }
  const hasFrom = !isNil(condition.from);
  return RANGE_OPS.has(condition.op) ? hasFrom && !isNil(condition.to) : hasFrom;
}

/** Whether the model narrows anything; empty models are never stored. */
export function isEmptyFilterModel(model: TFilterModel): boolean {
  switch (model.kind) {
    case 'text':
    case 'number':
    case 'date':
      return !model.conditions.some(isConditionComplete);
    case 'set':
      return model.values.length === 0;
    case 'enum':
      return model.value === '';
    case 'boolean':
      return false;
    case 'custom':
      return isNil(model.value);
  }
}

/** Joins the outcomes of the complete conditions; a model without any lets every value through. */
export function joinConditions<
  TCondition extends ITextCondition | INumberCondition | IDateCondition,
>(
  model: { readonly join: TJoin; readonly conditions: readonly TCondition[] },
  test: (condition: TCondition) => boolean
): boolean {
  const complete = model.conditions.filter(isConditionComplete);
  if (complete.length === 0) {
    return true;
  }
  return model.join === 'and' ? complete.every(test) : complete.some(test);
}
