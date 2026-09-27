import { isNil } from 'lodash-es';

import type { IEnumFilterModel } from '../model';
import { isEmptyFilterModel } from '../model';
import type { IFilterOption, IFilterSpec, TPredicate } from '../spec';

export interface IEnumFilterOptions<TValue> {
  readonly options: readonly IFilterOption[];
  readonly keyOf?: (value: TValue) => string;
  readonly readOnly?: boolean;
}

export type TEnumFilterSpec<TValue> = IFilterSpec<
  TValue,
  IEnumFilterModel,
  IEnumFilterOptions<TValue>
>;

/** One value out of a short, known list: the editor is a segmented control, not a checklist. */
export function enumFilter<TValue = unknown>(
  options: IEnumFilterOptions<TValue>
): TEnumFilterSpec<TValue> {
  const keyOf = (value: TValue): string =>
    isNil(value) ? '' : (options.keyOf?.(value) ?? String(value));
  return {
    kind: 'enum',
    options,
    readOnly: options.readOnly,
    isEmpty: isEmptyFilterModel,
    predicate(model): TPredicate<TValue, unknown> {
      return value => keyOf(value) === model.value;
    },
  };
}
