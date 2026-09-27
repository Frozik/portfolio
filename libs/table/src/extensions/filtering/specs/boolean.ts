import type { IBooleanFilterModel } from '../model';
import { isEmptyFilterModel } from '../model';
import type { IFilterSpec, TPredicate } from '../spec';

export interface IBooleanFilterOptions {
  readonly readOnly?: boolean;
}

export type TBooleanFilterSpec = IFilterSpec<unknown, IBooleanFilterModel, IBooleanFilterOptions>;

export function booleanFilter(options: IBooleanFilterOptions = {}): TBooleanFilterSpec {
  return {
    kind: 'boolean',
    options,
    readOnly: options.readOnly,
    isEmpty: isEmptyFilterModel,
    predicate(model): TPredicate<unknown, unknown> {
      return value => Boolean(value) === model.value;
    },
  };
}
