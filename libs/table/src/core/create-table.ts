import { runInAction } from 'mobx';

import { assert } from '@frozik/utils/assert/assert';

import { TableModel } from './table-model';
import type { ITableOptions, TAnyExtension } from './table-options';

type TUnionToIntersection<TUnion> = (
  TUnion extends unknown ? (member: TUnion) => void : never
) extends (member: infer TIntersection) => void
  ? TIntersection
  : never;

type TSliceOf<TExtension> = TExtension extends {
  readonly id: infer TId extends string;
  create(kernel: never): { readonly slice: infer TSlice };
}
  ? { readonly [TKey in TId]: TSlice }
  : never;

/** The slices of every extension in the tuple, keyed by extension id. */
export type TSlices<TExtensions extends readonly unknown[]> = TUnionToIntersection<
  TSliceOf<TExtensions[number]>
>;

export type TTable<TRow, TContext, TExtensions extends readonly TAnyExtension<TRow>[]> = TableModel<
  TRow,
  TContext
> &
  TSlices<TExtensions>;

/**
 * Creates the model. Each extension slice is attached under the extension id,
 * so `model.sorting` exists exactly when `sorting()` was passed — the type
 * says so too.
 */
export function createTable<
  TRow,
  TContext = undefined,
  const TExtensions extends readonly TAnyExtension<TRow>[] = readonly [],
>(options: ITableOptions<TRow, TContext, TExtensions>): TTable<TRow, TContext, TExtensions> {
  const model = runInAction(() => new TableModel<TRow, TContext>(options));
  for (const extension of options.extensions) {
    assert(!(extension.id in model), `Extension id "${extension.id}" clashes with a table member`);
    Object.defineProperty(model, extension.id, {
      value: model.extension(extension.id),
      enumerable: true,
      writable: false,
    });
  }
  return model as TTable<TRow, TContext, TExtensions>;
}
