import type { ReactNode } from 'react';

import type { TBivariantCallback } from '../../../core/kernel/callback';
import type { TFilterModel } from '../../../extensions/filtering/model';
import type { TAnyFilterSpec } from '../../../extensions/filtering/spec';
import type { IHeaderContext } from '../../column';

/** What a field in the filter row or an editor in the popover works with. */
export interface IFilterEditorContext<TRow, TValue = unknown> extends IHeaderContext<TRow, TValue> {
  readonly spec: TAnyFilterSpec<TValue>;
  readonly model: TFilterModel | undefined;
  set(model: TFilterModel | null): void;
}

export interface IFilterFieldContext<TRow, TValue = unknown> extends IFilterEditorContext<
  TRow,
  TValue
> {
  /** Opens the full editor under the field, for models the field cannot show. */
  openEditor(anchor: HTMLElement): void;
}

export type TFilterEditor<TRow, TValue = unknown> = TBivariantCallback<
  [props: IFilterEditorContext<TRow, TValue>],
  ReactNode
>;
export type TFilterField<TRow, TValue = unknown> = TBivariantCallback<
  [props: IFilterFieldContext<TRow, TValue>],
  ReactNode
>;

declare module '../../column' {
  interface IColumn<TRow, TValue> {
    /** Replaces the generated popover form; required for a `custom` spec. */
    readonly filterEditor?: TFilterEditor<TRow, TValue>;
    /** `false` leaves the column out of the filter row; a component replaces its field. */
    readonly filterRow?: false | TFilterField<TRow, TValue>;
  }
}
