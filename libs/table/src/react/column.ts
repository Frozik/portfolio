import type { ComponentType, CSSProperties, HTMLAttributes, ReactNode } from 'react';
import { isValidElement } from 'react';

import type { IColumnDefinition, IColumnTitle } from '../core/columns/column';
import type { IColumnLayout } from '../core/columns/columns-model';
import type { TBivariantCallback } from '../core/kernel/callback';
import type { TDisplayRow } from '../core/rows/display-row';
import type { TableModel } from '../core/table-model';
import type { IValidation } from '../extensions/editing/contracts';

export interface IHeaderContext<TRow, TValue = unknown> {
  readonly table: TableModel<TRow, unknown>;
  readonly column: IColumn<TRow, TValue>;
  readonly layout: IColumnLayout<TRow>;
}

export interface IGroupHeaderContext<TRow> {
  readonly table: TableModel<TRow, unknown>;
  readonly group: { readonly id: string; readonly title: string | IColumnTitle };
}

export interface ICellContext<TRow, TValue = unknown> extends IHeaderContext<TRow, TValue> {
  readonly row: TRow;
  readonly rowKey: string;
  readonly rowIndex: number;
  readonly value: TValue;
  readonly text: string;
  readonly isFocused: boolean;
  /** The table's editing session is on this cell. */
  readonly isEditing: boolean;
}

export type TCellMode = 'view' | 'edit';

/** How a cell component edits: through the table's session, or on its own with `change`. Inert without the editing extension. */
export interface ICellEdit<TValue> {
  /** The session's draft, or the value when there is no session. */
  readonly draft: TValue;
  readonly validation: IValidation | undefined;
  /** The key press that opened the session, for the field to start from. */
  readonly initialKey: string | undefined;
  update(draft: TValue): void;
  commit(): void;
  cancel(): void;
  /** Hands a value produced without a session to the table; `false` when it was refused (locked, invalid). */
  change(value: TValue): boolean;
}

/**
 * What one cell component receives: the context, plus the mode the table put
 * it in and the means to edit. `mode` is `undefined` on an `interactive`
 * column, where the component decides its mode itself.
 */
export interface ICellProps<TRow, TValue = unknown> extends ICellContext<TRow, TValue> {
  readonly mode: TCellMode | undefined;
  /** The column rule, the table rules and the row state all allow an edit right now. */
  readonly editable: boolean;
  readonly edit: ICellEdit<TValue>;
}

export interface IRowContext<TRow> {
  readonly table: TableModel<TRow, unknown>;
  readonly displayRow: TDisplayRow<TRow>;
  readonly rowIndex: number;
}

export interface ICellDecoration {
  readonly className?: string;
  readonly data?: Readonly<Record<string, string | boolean | undefined>>;
  /** ARIA states of the cell (`selected`, `expanded`…), keyed without the `aria-` prefix. */
  readonly aria?: Readonly<Record<string, string | boolean | undefined>>;
  /** Only for values computed from the data (a heatmap colour); static looks belong to a class. */
  readonly style?: CSSProperties;
}

/**
 * A function component for a cell (both modes) or a header of one column.
 * Typed bivariantly in its props so a column of one value type stays
 * assignable to `IColumn<TRow, unknown>`; a view-only component takes the
 * subset it needs, as `ICellContext<TRow>` or `ICellProps<TRow, TValue>`;
 * `memo` and `observer` components qualify too.
 */
export type TCellComponent<TRow, TValue = unknown> = TBivariantCallback<
  [props: ICellProps<TRow, TValue>],
  ReactNode
>;
export type THeaderComponent<TRow, TValue = unknown> = TBivariantCallback<
  [props: IHeaderContext<TRow, TValue>],
  ReactNode
>;

/** A value, or a function of the cell that computes it: presentation may depend on the data. */
export type TResolvable<TValue, TContext> =
  | TValue
  | TBivariantCallback<[context: TContext], TValue>;

export function resolve<TValue, TContext>(
  resolvable: TResolvable<TValue, TContext>,
  context: TContext
): TValue {
  return typeof resolvable === 'function'
    ? (resolvable as (context: TContext) => TValue)(context)
    : resolvable;
}

/**
 * A cell component and a per-cell resolver are both functions, so the only
 * way to tell them apart is to call: a resolver hands back a component (a
 * function, or a `memo` / `observer` object), a component hands back what to
 * render. Plain function components are rendered from that result, so a cell
 * component that uses hooks must be wrapped in `memo` or `observer`.
 */
export function resolveCell<TRow, TValue>(
  cell: TResolvable<TCellComponent<TRow, TValue>, ICellProps<TRow, TValue>> | undefined,
  context: ICellProps<TRow, TValue>
): { readonly Component: TCellComponent<TRow, TValue> } | { readonly node: ReactNode } | undefined {
  if (cell === undefined) {
    return undefined;
  }
  if (typeof cell !== 'function') {
    return { Component: cell };
  }
  const result: unknown = cell(context);
  if (
    typeof result === 'function' ||
    (typeof result === 'object' &&
      result !== null &&
      '$$typeof' in result &&
      !isValidElement(result))
  ) {
    return { Component: result as TCellComponent<TRow, TValue> };
  }
  return { node: result as ReactNode };
}

export interface INamedPart<TContext> {
  readonly id: string;
  readonly render: ComponentType<TContext>;
  /** Shown on hover and focus only, unless `active` says the part carries state. */
  readonly hoverOnly?: boolean;
  active?(context: TContext): boolean;
}

/** Element attributes one extension adds; event handlers of every extension run in order until one claims the event with `preventDefault()`. */
export interface INamedProps<TContext> {
  readonly id: string;
  props(context: TContext): HTMLAttributes<HTMLDivElement>;
}

export interface INamedDecorator<TContext> {
  readonly id: string;
  decorate(context: TContext): ICellDecoration | undefined;
}

export type TOverride = false | ComponentType<never>;

export interface ITitleSpec<TRow, TValue> extends IColumnTitle {
  readonly component: THeaderComponent<TRow, TValue>;
}

/**
 * A column as the React adapter sees it: the kernel definition plus
 * presentation slots. Every slot is `NoInfer`: the value type comes from
 * `value` alone, so a component written for `unknown` fits any column.
 */
export interface IColumn<TRow, TValue = unknown> extends IColumnDefinition<TRow, TValue> {
  readonly title: string | ITitleSpec<TRow, NoInfer<TValue>>;
  /** The one component of the cell, for both modes; a resolver picks it per cell, by data or by mode. */
  readonly cell?: NoInfer<TResolvable<TCellComponent<TRow, TValue>, ICellProps<TRow, TValue>>>;
  readonly decorate?: NoInfer<TResolvable<ICellDecoration | undefined, ICellContext<TRow, TValue>>>;
  readonly header?: NoInfer<THeaderComponent<TRow, TValue>>;
  readonly headerDecorate?: NoInfer<
    TResolvable<ICellDecoration | undefined, IHeaderContext<TRow, TValue>>
  >;
  parts?(
    parts: readonly INamedPart<IHeaderContext<TRow>>[],
    context: IHeaderContext<TRow, TValue>
  ): readonly INamedPart<IHeaderContext<TRow>>[];
  readonly overrides?: Readonly<Record<string, TOverride>>;
  readonly cellClass?: NoInfer<TResolvable<string | undefined, ICellContext<TRow, TValue>>>;
}

export type TAnyReactColumn<TRow> = IColumn<TRow, unknown>;

/** What a table-level `cellSpec` may override for one cell: how the value reads, edits and looks — never what the column is. */
export type TCellSpec<TRow, TValue = unknown> = Partial<
  Omit<
    IColumn<TRow, TValue>,
    | 'id'
    | 'title'
    | 'value'
    | 'width'
    | 'minWidth'
    | 'maxWidth'
    | 'flex'
    | 'pin'
    | 'hidden'
    | 'lock'
    | 'header'
    | 'headerDecorate'
    | 'parts'
    | 'overrides'
    | 'sort'
    | 'filter'
    | 'filterRow'
    | 'filterEditor'
    | 'aggregate'
    | 'groupable'
    | 'groupTitle'
  >
>;

export type TCellSpecResolver<TRow> = (context: ICellContext<TRow>) => TCellSpec<TRow> | undefined;

export function reactColumn<TRow>() {
  return <TValue>(column: IColumn<TRow, TValue>): IColumn<TRow, TValue> => column;
}
