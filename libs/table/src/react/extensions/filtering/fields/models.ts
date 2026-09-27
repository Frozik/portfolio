import type {
  IDateCondition,
  IDateFilterModel,
  INumberCondition,
  INumberFilterModel,
  ITextCondition,
  ITextFilterModel,
  TConditionModel,
  TJoin,
} from '../../../../extensions/filtering/model';

export const DEFAULT_TEXT_OP = 'contains';
export const DEFAULT_NUMBER_OP = 'equals';
export const DEFAULT_DATE_OP = 'greaterOrEqual';

export function textModel(
  conditions: readonly ITextCondition[],
  join: TJoin = 'and'
): ITextFilterModel {
  return { kind: 'text', join, conditions };
}

export function numberModel(
  conditions: readonly INumberCondition[],
  join: TJoin = 'and'
): INumberFilterModel {
  return { kind: 'number', join, conditions };
}

export function dateModel(
  conditions: readonly IDateCondition[],
  join: TJoin = 'and'
): IDateFilterModel {
  return { kind: 'date', join, conditions };
}

export function withConditions<TModel extends TConditionModel>(
  model: TModel,
  conditions: TModel['conditions']
): TModel {
  return { ...model, conditions };
}

interface INumberSeparators {
  readonly group: string;
  readonly decimal: string;
}

const separatorsByLocale = new Map<string, INumberSeparators>();

/** What the locale prints between thousands and before the fraction, read off `Intl` once. */
function separatorsOf(locale: string): INumberSeparators {
  const cached = separatorsByLocale.get(locale);
  if (cached !== undefined) {
    return cached;
  }
  const parts = new Intl.NumberFormat(locale).formatToParts(1234567.5);
  const separators = {
    group: parts.find(part => part.type === 'group')?.value ?? ',',
    decimal: parts.find(part => part.type === 'decimal')?.value ?? '.',
  };
  separatorsByLocale.set(locale, separators);
  return separators;
}

/** A number as the locale writes it, so text copied from a cell ("9,672" in Russian) is a valid filter value. */
export function parseNumber(text: string, locale: string): number | undefined {
  const { group, decimal } = separatorsOf(locale);
  const normalized = text.replaceAll(/\s/g, '').split(group).join('').replace(decimal, '.');
  if (normalized === '') {
    return undefined;
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : undefined;
}

const MAX_FRACTION_DIGITS = 20;

export function numberText(value: number | undefined, locale: string): string {
  return value === undefined
    ? ''
    : new Intl.NumberFormat(locale, {
        useGrouping: false,
        maximumFractionDigits: MAX_FRACTION_DIGITS,
      }).format(value);
}

/** Date-only bounds from the two inputs of the filter row: both → `between`, one → open range. */
export function dateRangeModel(from: string, to: string): IDateFilterModel {
  if (from !== '' && to !== '') {
    return dateModel([{ op: 'between', from, to }]);
  }
  if (from !== '') {
    return dateModel([{ op: 'greaterOrEqual', from }]);
  }
  return dateModel(to === '' ? [] : [{ op: 'lessOrEqual', from: to }]);
}
