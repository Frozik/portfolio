import type { IExtensionInstance, ITableExtension } from '../../core/kernel/extension';
import type { IViewContributions } from '../slots';

/** The React flavour of an extension: its core plus what it puts into the grid's slots. */
export function withView<TRow, TId extends string, TSlice>(
  extension: ITableExtension<TRow, TId, TSlice>,
  view: (slice: TSlice) => IViewContributions<TRow>
): ITableExtension<TRow, TId, TSlice> {
  return {
    ...extension,
    create(kernel): IExtensionInstance<TRow, TSlice> {
      const instance = extension.create(kernel);
      return { ...instance, view: view(instance.slice) as Readonly<Record<string, unknown>> };
    },
  };
}
