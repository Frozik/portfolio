import { isNil } from 'lodash-es';

import type { ITextCondition, ITextFilterModel, TTextOp } from '../model';
import { isBlankValue, isEmptyFilterModel, joinConditions, OPS_ACCEPTING_EMPTY } from '../model';
import type { IConditionFilterOptions, IFilterOperator, IFilterSpec, TPredicate } from '../spec';
import { resolveOperators } from '../spec';

export interface ITextFilterOptions extends IConditionFilterOptions<unknown, ITextCondition> {
  readonly caseSensitive?: boolean;
  readonly trim?: boolean;
  /** Turns the cell value into the text the operators see; `String(value)` otherwise. */
  readonly textOf?: (value: unknown) => string;
}

export type TTextFilterSpec = IFilterSpec<unknown, ITextFilterModel, ITextFilterOptions> & {
  readonly operators: readonly IFilterOperator<unknown, ITextCondition>[];
};

export const TEXT_OPS: readonly TTextOp[] = [
  'contains',
  'notContains',
  'equals',
  'notEquals',
  'startsWith',
  'endsWith',
  'matchesRegex',
  'blank',
  'notBlank',
];

function safeRegExp(pattern: string, flags: string): RegExp | undefined {
  try {
    return new RegExp(pattern, flags);
  } catch {
    return undefined;
  }
}

function builtInTest(
  op: string,
  needle: string,
  options: ITextFilterOptions
): ((haystack: string) => boolean) | undefined {
  switch (op) {
    case 'contains':
      return haystack => haystack.includes(needle);
    case 'notContains':
      return haystack => !haystack.includes(needle);
    case 'equals':
      return haystack => haystack === needle;
    case 'notEquals':
      return haystack => haystack !== needle;
    case 'startsWith':
      return haystack => haystack.startsWith(needle);
    case 'endsWith':
      return haystack => haystack.endsWith(needle);
    case 'matchesRegex': {
      const regexp = safeRegExp(needle, options.caseSensitive === true ? '' : 'i');
      return regexp === undefined ? () => true : haystack => regexp.test(haystack);
    }
    case 'blank':
      return haystack => haystack === '';
    case 'notBlank':
      return haystack => haystack !== '';
    default:
      return undefined;
  }
}

export function textFilter(options: ITextFilterOptions = {}): TTextFilterSpec {
  const operators = resolveOperators(TEXT_OPS, options.operators);
  const normalize = (text: string): string => {
    const trimmed = options.trim === false ? text : text.trim();
    return options.caseSensitive === true ? trimmed : trimmed.toLowerCase();
  };
  const textOf = (value: unknown): string =>
    isNil(value) ? '' : (options.textOf?.(value) ?? String(value));
  return {
    kind: 'text',
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
        const test = builtInTest(condition.op, normalize(condition.text ?? ''), options);
        if (test === undefined) {
          return () => true;
        }
        return (value: unknown) =>
          isBlankValue(value) && !OPS_ACCEPTING_EMPTY.has(condition.op)
            ? false
            : test(normalize(textOf(value)));
      });
      return value =>
        joinConditions(model, condition => tests[model.conditions.indexOf(condition)](value));
    },
  };
}
