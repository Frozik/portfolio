import { isNil } from 'lodash-es';

import type { INumberCondition, INumberFilterModel, TNumberOp } from '../model';
import { isEmptyFilterModel, joinConditions, OPS_ACCEPTING_EMPTY } from '../model';
import type { IConditionFilterOptions, IFilterOperator, IFilterSpec, TPredicate } from '../spec';
import { resolveOperators } from '../spec';

export interface INumberFilterOptions extends IConditionFilterOptions<unknown, INumberCondition> {
  /** Whether `between` includes its ends; it does by default. */
  readonly inclusive?: boolean;
}

export type TNumberFilterSpec = IFilterSpec<unknown, INumberFilterModel, INumberFilterOptions> & {
  readonly operators: readonly IFilterOperator<unknown, INumberCondition>[];
};

export const NUMBER_OPS: readonly TNumberOp[] = [
  'equals',
  'notEquals',
  'greaterThan',
  'greaterOrEqual',
  'lessThan',
  'lessOrEqual',
  'between',
  'blank',
  'notBlank',
];

type TComparable = number | bigint;

function comparable(value: unknown): TComparable | undefined {
  if (typeof value === 'number') {
    return Number.isNaN(value) ? undefined : value;
  }
  return typeof value === 'bigint' ? value : undefined;
}

/** Comparison of number and bigint by `<` / `>` is exact; equality needs the same primitive type. */
export function compareNumbers(left: TComparable, right: TComparable): number {
  if (left < right) {
    return -1;
  }
  return left > right ? 1 : 0;
}

function builtInTest(
  condition: INumberCondition,
  inclusive: boolean
): ((value: TComparable | undefined) => boolean) | undefined {
  const { op, from, to } = condition;
  const against = (test: (order: number) => boolean) => (value: TComparable | undefined) =>
    value !== undefined && from !== undefined && test(compareNumbers(value, from));
  switch (op) {
    case 'equals':
      return against(order => order === 0);
    case 'notEquals':
      return value =>
        value === undefined || from === undefined || compareNumbers(value, from) !== 0;
    case 'greaterThan':
      return against(order => order > 0);
    case 'greaterOrEqual':
      return against(order => order >= 0);
    case 'lessThan':
      return against(order => order < 0);
    case 'lessOrEqual':
      return against(order => order <= 0);
    case 'between':
      return value => {
        if (value === undefined || from === undefined || to === undefined) {
          return false;
        }
        const low = compareNumbers(value, from);
        const high = compareNumbers(value, to);
        return inclusive ? low >= 0 && high <= 0 : low > 0 && high < 0;
      };
    case 'blank':
      return value => value === undefined;
    case 'notBlank':
      return value => value !== undefined;
    default:
      return undefined;
  }
}

export function numberFilter(options: INumberFilterOptions = {}): TNumberFilterSpec {
  const operators = resolveOperators(NUMBER_OPS, options.operators);
  return {
    kind: 'number',
    options,
    operators,
    readOnly: options.readOnly,
    isEmpty: isEmptyFilterModel,
    predicate(model): TPredicate<unknown, unknown> {
      const tests = model.conditions.map(condition => {
        const custom = operators.find(operator => operator.id === condition.op)?.predicate;
        if (custom !== undefined) {
          return (value: unknown) => custom(condition, value);
        }
        const test = builtInTest(condition, options.inclusive !== false);
        if (test === undefined) {
          return () => true;
        }
        return (value: unknown) =>
          isNil(value) && !OPS_ACCEPTING_EMPTY.has(condition.op) ? false : test(comparable(value));
      });
      return value =>
        joinConditions(model, condition => tests[model.conditions.indexOf(condition)](value));
    },
  };
}
