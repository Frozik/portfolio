import type { ComponentType } from 'react';

import type { TableModel } from '../core/table-model';
import type {
  ICellContext,
  IGroupHeaderContext,
  IHeaderContext,
  INamedDecorator,
  INamedPart,
  INamedProps,
  IRowContext,
  TCellComponent,
  THeaderComponent,
  TOverride,
} from './column';

export interface IViewContext<TRow> {
  readonly table: TableModel<TRow, unknown>;
}

/** Every place the grid lets an extension put something. Lists accumulate; single slots replace the default. */
export interface IViewContributions<TRow> {
  /** Replaces the grid itself: another representation of the same rows and columns (a list, a canvas). */
  readonly root?: ComponentType<IViewContext<TRow>>;
  readonly 'header.cell.parts'?: readonly INamedPart<IHeaderContext<TRow>>[];
  readonly 'header.cell.props'?: readonly INamedProps<IHeaderContext<TRow>>[];
  readonly 'header.cell.decorate'?: readonly INamedDecorator<IHeaderContext<TRow>>[];
  readonly 'header.cell'?: THeaderComponent<TRow>;
  readonly 'header.group'?: ComponentType<IGroupHeaderContext<TRow>>;
  readonly 'header.row.before'?: ComponentType<IViewContext<TRow>>;
  readonly 'header.row.after'?: ComponentType<IViewContext<TRow>>;
  readonly cell?: TCellComponent<TRow>;
  readonly 'cell.props'?: readonly INamedProps<ICellContext<TRow>>[];
  readonly 'cell.decorate'?: readonly INamedDecorator<ICellContext<TRow>>[];
  readonly 'cell.overlay'?: TCellComponent<TRow>;
  readonly row?: ComponentType<IRowContext<TRow>>;
  readonly 'row.after'?: ComponentType<IRowContext<TRow>>;
  readonly 'body.overlay'?: ComponentType<IViewContext<TRow>>;
  readonly toolbar?: readonly INamedPart<IViewContext<TRow>>[];
  readonly floating?: readonly INamedPart<IViewContext<TRow>>[];
}

type TListSlot = {
  [TKey in keyof IViewContributions<never>]-?: NonNullable<
    IViewContributions<never>[TKey]
  > extends readonly unknown[]
    ? TKey
    : never;
}[keyof IViewContributions<never>];

type TSingleSlot = Exclude<keyof IViewContributions<never>, TListSlot>;

export interface IResolvedSlots<TRow> {
  list<TKey extends TListSlot>(slot: TKey): NonNullable<IViewContributions<TRow>[TKey]>;
  single<TKey extends TSingleSlot>(slot: TKey): IViewContributions<TRow>[TKey];
}

function applyOverrides<TItem extends { readonly id: string }>(
  items: readonly TItem[],
  overrides: Readonly<Record<string, TOverride>>
): readonly TItem[] {
  return items.flatMap(item => {
    const override = overrides[item.id];
    if (override === undefined) {
      return [item];
    }
    if (override === false) {
      return [];
    }
    return [{ ...item, render: override }];
  });
}

/**
 * Collects the contributions of every registered extension once. List slots
 * keep extension order; a single slot takes the first contribution. Overrides
 * address a contribution by its id: `false` drops it, a component replaces it.
 */
export function resolveSlots<TRow>(table: TableModel<TRow, unknown>): IResolvedSlots<TRow> {
  const contributions = [...table.views.values()] as readonly IViewContributions<TRow>[];
  const overrides = Object.assign({}, ...[...table.overrides.values()]) as Readonly<
    Record<string, TOverride>
  >;
  const lists = new Map<string, readonly unknown[]>();
  const singles = new Map<string, unknown>();
  return {
    list(slot) {
      const cached = lists.get(slot);
      if (cached !== undefined) {
        return cached as never;
      }
      const items = contributions.flatMap(
        contribution => (contribution[slot] ?? []) as readonly { readonly id: string }[]
      );
      const resolved = applyOverrides(items, overrides);
      lists.set(slot, resolved);
      return resolved as never;
    },
    single(slot) {
      if (!singles.has(slot)) {
        singles.set(
          slot,
          contributions.find(contribution => contribution[slot] !== undefined)?.[slot]
        );
      }
      return singles.get(slot) as never;
    },
  };
}
