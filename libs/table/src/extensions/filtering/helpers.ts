import type { TFilterModel } from './model';
import { isConditionComplete } from './model';

/** The keys a `set` filter chose, for a server query. */
export function setValues(model: TFilterModel | undefined): readonly string[] | undefined {
  return model?.kind === 'set' && model.values.length > 0 ? model.values : undefined;
}

/** The texts of the complete `equals`/`contains` conditions of a text filter. */
export function textValues(model: TFilterModel | undefined): readonly string[] | undefined {
  if (model?.kind !== 'text') {
    return undefined;
  }
  const texts = model.conditions
    .filter(condition => isConditionComplete(condition) && condition.text !== undefined)
    .map(condition => condition.text ?? '');
  return texts.length === 0 ? undefined : texts;
}

export interface IRange<TBound> {
  readonly from?: TBound;
  readonly to?: TBound;
}

function rangeOf<TBound>(
  conditions: readonly { readonly op: string; readonly from?: TBound; readonly to?: TBound }[]
): IRange<TBound> | undefined {
  let range: IRange<TBound> = {};
  for (const condition of conditions.filter(isConditionComplete)) {
    switch (condition.op) {
      case 'equals':
        range = { from: condition.from, to: condition.from };
        break;
      case 'greaterThan':
      case 'greaterOrEqual':
        range = { ...range, from: condition.from };
        break;
      case 'lessThan':
      case 'lessOrEqual':
        range = { ...range, to: condition.from };
        break;
      case 'between':
        range = { from: condition.from, to: condition.to };
        break;
      default:
        break;
    }
  }
  return range.from === undefined && range.to === undefined ? undefined : range;
}

/** The bounds a number filter implies, for a server query that takes a range. */
export function numberRange(model: TFilterModel | undefined): IRange<number> | undefined {
  return model?.kind === 'number' ? rangeOf(model.conditions) : undefined;
}

export function dateRange(model: TFilterModel | undefined): IRange<string> | undefined {
  return model?.kind === 'date' ? rangeOf(model.conditions) : undefined;
}
