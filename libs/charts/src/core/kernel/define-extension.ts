import type { IChartExtension, IExtensionInstance } from './extension';
import type { IChartKernel } from './kernel';

type TExtensionBody<TX, TSlice> = Omit<IExtensionInstance<TX, TSlice>, 'slice'> & {
  readonly slice?: TSlice;
};

/** An extension written in place, for an application's own behaviour: no class, only what it contributes. */
export function defineExtension<TX, TId extends string, TSlice = undefined>(
  id: TId,
  body: TExtensionBody<TX, TSlice> | ((kernel: IChartKernel<TX>) => TExtensionBody<TX, TSlice>),
  requires?: readonly string[]
): IChartExtension<TX, TId, TSlice> {
  return {
    id,
    requires,
    create(kernel): IExtensionInstance<TX, TSlice> {
      const resolved = typeof body === 'function' ? body(kernel) : body;
      return { ...resolved, slice: resolved.slice as TSlice };
    },
  };
}
