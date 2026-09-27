import { isNil } from 'lodash-es';

import type { ISetFilterModel } from '../model';
import { isEmptyFilterModel } from '../model';
import type { IFilterOption, IFilterSpec, TPredicate, TSetValues } from '../spec';

export const BLANK_KEY = '';

export interface ISetFilterOptions<TValue> {
  readonly values: TSetValues<TValue>;
  /** The key a value is stored under in the model; `String(value)` and `''` for empty by default. */
  readonly keyOf?: (value: TValue) => string;
  readonly labelOf?: (value: TValue) => string;
  /** Lets the user pick the rows whose value is empty; the option's key is what the server receives. */
  readonly extraOption?: IFilterOption;
  readonly readOnly?: boolean;
}

export type TSetFilterSpec<TValue> = IFilterSpec<
  TValue,
  ISetFilterModel,
  ISetFilterOptions<TValue>
> & {
  keyOf(value: TValue): string;
  labelOf(value: TValue): string;
};

export function setFilter<TValue = unknown>(
  options: ISetFilterOptions<TValue>
): TSetFilterSpec<TValue> {
  const keyOf = (value: TValue): string =>
    isNil(value)
      ? (options.extraOption?.key ?? BLANK_KEY)
      : (options.keyOf?.(value) ?? String(value));
  const labelOf = (value: TValue): string =>
    isNil(value)
      ? (options.extraOption?.label ?? BLANK_KEY)
      : (options.labelOf?.(value) ?? String(value));
  return {
    kind: 'set',
    options,
    readOnly: options.readOnly,
    keyOf,
    labelOf,
    isEmpty: isEmptyFilterModel,
    predicate(model): TPredicate<TValue, unknown> {
      const chosen = new Set(model.values);
      return value => chosen.has(keyOf(value));
    },
  };
}
