import type { TColumnKind } from '../../core/columns/column';
import type { TBivariantCallback } from '../../core/kernel/callback';
import type {
  IBooleanFilterModel,
  ICustomFilterModel,
  IDateFilterModel,
  IEnumFilterModel,
  INumberFilterModel,
  ISetFilterModel,
  ITextFilterModel,
  TFilterKind,
  TFilterModel,
  TJoin,
} from './model';

/** Bivariant in the value so a spec over `string` stays assignable to the column-level `unknown`. */
export type TPredicate<TValue, TRow> = TBivariantCallback<[value: TValue, row: TRow], boolean>;

/** An operator the application adds to a column: its id is what the model stores and the server receives. */
export interface IFilterOperator<TValue, TCondition> {
  readonly id: string;
  readonly label: string;
  /** Without it the operator is server-only and lets every row through on the client. */
  readonly predicate?: TBivariantCallback<[condition: TCondition, value: TValue], boolean>;
  readonly valueless?: boolean;
}

export interface IConditionFilterOptions<TValue, TCondition> {
  readonly operators?: readonly (string | IFilterOperator<TValue, TCondition>)[];
  readonly defaultOp?: string;
  readonly defaultJoin?: TJoin;
  readonly maxConditions?: number;
  readonly readOnly?: boolean;
}

export interface IFilterOption {
  readonly key: string;
  readonly label: string;
}

export type TSetValues<TValue> =
  | readonly TValue[]
  | 'accumulate'
  | ((search: string, signal: AbortSignal) => Promise<readonly IFilterOption[]>);

/**
 * The contract of a column filter: which model it takes, how the model becomes
 * a predicate over the column value, and the parameters the UI builds its
 * editor from. `options` is opaque to the kernel and typed by the spec kind.
 */
export interface IFilterSpec<TValue, TModel extends TFilterModel, TOptions> {
  readonly kind: TModel['kind'];
  readonly options: TOptions;
  predicate(model: TModel): TPredicate<TValue, unknown>;
  isEmpty(model: TModel): boolean;
  readonly readOnly?: boolean;
}

export type TAnyFilterSpec<TValue = unknown> =
  | IFilterSpec<TValue, ITextFilterModel, unknown>
  | IFilterSpec<TValue, INumberFilterModel, unknown>
  | IFilterSpec<TValue, IDateFilterModel, unknown>
  | IFilterSpec<TValue, ISetFilterModel, unknown>
  | IFilterSpec<TValue, IEnumFilterModel, unknown>
  | IFilterSpec<TValue, IBooleanFilterModel, unknown>
  | IFilterSpec<TValue, ICustomFilterModel, unknown>;

/** What a column declares: `true` picks the spec of its kind, a kind name picks that default spec. */
export type TColumnFilter<TValue> = true | TFilterKind | TAnyFilterSpec<TValue>;

declare module '../../core/columns/column' {
  interface IColumnDefinition<TRow, TValue> {
    /** `NoInfer`: the value type comes from `value`, a spec built for `unknown` still fits. */
    readonly filter?: NoInfer<TColumnFilter<TValue>>;
  }
}

export const FILTER_KIND_BY_COLUMN_KIND: Readonly<Record<TColumnKind, TFilterKind | undefined>> = {
  text: 'text',
  number: 'number',
  boolean: 'boolean',
  date: 'date',
  datetime: 'date',
  custom: undefined,
};

/** Resolves the operator list of a spec: names of built-ins and application operators with their predicates. */
export function resolveOperators<TValue, TCondition>(
  builtIn: readonly string[],
  chosen: readonly (string | IFilterOperator<TValue, TCondition>)[] | undefined
): readonly IFilterOperator<TValue, TCondition>[] {
  const source = chosen ?? builtIn;
  return source.map(operator =>
    typeof operator === 'string' ? { id: operator, label: operator } : operator
  );
}
