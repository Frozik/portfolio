import { defineExtension } from '../../core/kernel/define-extension';
import type { TExtensionBody } from '../../core/kernel/define-extension';
import type { ITableExtension } from '../../core/kernel/extension';
import type { ITableKernel } from '../../core/kernel/kernel';
import type { TOverride } from '../column';
import type { IViewContributions } from '../slots';

export type TAppExtensionBody<TRow, TSlice> = Omit<
  TExtensionBody<TRow, TSlice>,
  'view' | 'overrides'
> & {
  readonly view?: IViewContributions<TRow>;
  /** Contributions of other extensions this one switches off or replaces, by their id. */
  readonly overrides?: Readonly<Record<string, TOverride>>;
};

/** `defineExtension` with the React slots typed: the way an application adds its own parts to a table. */
export function appExtension<TRow, TId extends string = string, TSlice = undefined>(
  id: TId,
  body:
    | TAppExtensionBody<TRow, TSlice>
    | ((kernel: ITableKernel<TRow, unknown>) => TAppExtensionBody<TRow, TSlice>),
  requires?: readonly string[]
): ITableExtension<TRow, TId, TSlice> {
  return defineExtension<TRow, TId, TSlice>(
    id,
    kernel => {
      const resolved = typeof body === 'function' ? body(kernel) : body;
      return {
        ...resolved,
        view: resolved.view as Readonly<Record<string, unknown>> | undefined,
        overrides: resolved.overrides as Readonly<Record<string, unknown>> | undefined,
      };
    },
    requires
  );
}
