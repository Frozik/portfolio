/**
 * A function type whose parameters are checked bivariantly, the way methods
 * are. Column callbacks use it so a column typed for one value type stays
 * assignable to `IColumnDefinition<TRow, unknown>`.
 */
export type TBivariantCallback<TArgs extends readonly unknown[], TResult> = {
  bivarianceHack(...args: TArgs): TResult;
}['bivarianceHack'];
