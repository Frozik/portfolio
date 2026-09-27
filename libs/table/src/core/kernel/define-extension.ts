import type { IExtensionInstance, ITableExtension } from './extension';
import type { ITableKernel } from './kernel';

export type TExtensionBody<TRow, TSlice> = Partial<
  Omit<IExtensionInstance<TRow, TSlice>, 'slice'>
> & {
  readonly slice?: TSlice;
};

/**
 * An extension written in place, for the application's own guards, menu
 * items, keys or view parts: everything an extension may contribute, without
 * a class. The body may depend on the kernel through a function.
 */
export function defineExtension<TRow, TId extends string, TSlice = undefined>(
  id: TId,
  body:
    | TExtensionBody<TRow, TSlice>
    | ((kernel: ITableKernel<TRow, unknown>) => TExtensionBody<TRow, TSlice>),
  requires?: readonly string[]
): ITableExtension<TRow, TId, TSlice> {
  return {
    id,
    requires,
    create(kernel): IExtensionInstance<TRow, TSlice> {
      const resolved = typeof body === 'function' ? body(kernel) : body;
      return {
        ...resolved,
        slice: resolved.slice as TSlice,
        dispose: resolved.dispose ?? (() => undefined),
      };
    },
  };
}
