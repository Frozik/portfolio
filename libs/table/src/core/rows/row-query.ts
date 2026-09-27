export type TSortDirection = 'asc' | 'desc';

export interface ISortItem {
  readonly columnId: string;
  readonly direction: TSortDirection;
}

/** Base of every filter model; the filtering extension defines the concrete union. */
export interface IFilterModel {
  readonly kind: string;
}

export interface IQuickFilter {
  readonly text: string;
  readonly mode: 'text' | 'regexp';
  readonly caseSensitive: boolean;
}

/** Everything a server needs to answer for a window of rows. Serializable. */
export interface IRowQuery {
  readonly sort: readonly ISortItem[];
  readonly filters: Readonly<Record<string, IFilterModel>>;
  readonly quick: IQuickFilter;
  readonly extra: Readonly<Record<string, unknown>>;
}

export const EMPTY_QUERY: IRowQuery = {
  sort: [],
  filters: {},
  quick: { text: '', mode: 'text', caseSensitive: false },
  extra: {},
};

export function mergeQuery(parts: readonly Partial<IRowQuery>[]): IRowQuery {
  return Object.assign({}, EMPTY_QUERY, ...parts);
}
