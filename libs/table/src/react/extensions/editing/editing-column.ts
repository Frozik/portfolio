import type { ReactNode } from 'react';

import type { TBivariantCallback } from '../../../core/kernel/callback';
import type { IValidation } from '../../../extensions/editing/contracts';
import type { ICellContext, TResolvable } from '../../column';

export type TEditorKind =
  | 'text'
  | 'number'
  | 'date'
  | 'datetime'
  | 'checkbox'
  | 'select'
  | 'textarea';

export interface IEditorOption {
  readonly value: unknown;
  readonly label: string;
}

/** Parameters the built-in editors read; a custom editor gets them verbatim. */
export interface IEditorOptions<TRow> {
  readonly values?:
    | readonly IEditorOption[]
    | TBivariantCallback<[row: TRow], readonly IEditorOption[]>;
  readonly decimal?: number;
  readonly min?: number;
  readonly max?: number;
  readonly step?: number;
  readonly allowNegative?: boolean;
  readonly maxLength?: number;
  readonly timeZone?: string;
  readonly showTime?: boolean;
}

/** What every editor receives: the draft, how to change it, and how the session ends. */
export interface IEditorProps<TRow, TValue = unknown> extends ICellContext<TRow, TValue> {
  readonly draft: TValue;
  readonly validation: IValidation | undefined;
  readonly initialKey: string | undefined;
  readonly locale: string;
  readonly options: IEditorOptions<TRow>;
  onChange(draft: TValue): void;
  commit(): void;
  cancel(): void;
}

export type TEditorComponent<TRow, TValue = unknown> = TBivariantCallback<
  [props: IEditorProps<TRow, TValue>],
  ReactNode
>;

export interface IEditorSpec<TRow, TValue = unknown> {
  readonly component?: TEditorComponent<TRow, TValue>;
  readonly kind?: TEditorKind;
  /** The editor floats under the cell instead of replacing it in place. */
  readonly popup?: boolean;
  readonly options?: IEditorOptions<TRow>;
}

export type TEditor<TRow, TValue = unknown> = TEditorKind | IEditorSpec<TRow, TValue> | undefined;

declare module '../../column' {
  interface IColumn<TRow, TValue> {
    /** The editor kind or spec, possibly per cell; `undefined` makes that cell read-only. `NoInfer`: the value type comes from `value`. */
    readonly editor?: NoInfer<TResolvable<TEditor<TRow, TValue>, ICellContext<TRow, TValue>>>;
  }
}
