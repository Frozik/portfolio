import { assert } from '@frozik/utils/assert/assert';

import { ChartModel } from './chart-model';
import type { IChartOptions, TAnyExtension } from './chart-options';

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
type TSlices<TExtensions extends readonly unknown[]> = TUnionToIntersection<
  TSliceOf<TExtensions[number]>
>;

export type TChart<TX, TExtensions extends readonly TAnyExtension<TX>[]> = ChartModel<TX> &
  TSlices<TExtensions>;

/**
 * Creates the model. Each extension slice is attached under the extension id,
 * so `chart.crosshair` exists exactly when `crosshair()` was passed — the type
 * says so too.
 */
export function createChart<
  TX,
  const TExtensions extends readonly TAnyExtension<TX>[] = readonly [],
>(options: IChartOptions<TX, TExtensions & readonly TAnyExtension<TX>[]>): TChart<TX, TExtensions> {
  const model = new ChartModel<TX>(options);
  for (const extension of options.extensions) {
    assert(!(extension.id in model), `extension id "${extension.id}" clashes with a chart member`);
    Object.defineProperty(model, extension.id, {
      value: model.extension(extension.id),
      enumerable: true,
      writable: false,
    });
  }
  return model as TChart<TX, TExtensions>;
}
