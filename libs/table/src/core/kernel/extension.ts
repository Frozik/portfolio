import type { TAnyColumn } from '../columns/column';
import type { TDisplayRow } from '../rows/display-row';
import type { IPipelineStage } from '../rows/pipeline';
import type { IRowQuery } from '../rows/row-query';
import type { TGuards } from './command-bus';
import type { ITableCommands } from './contracts';
import type { ITableKernel } from './kernel';
import type { IMenuContext, TMenuItem } from './menu';

export interface IStateSlice {
  read(): unknown;
  write(value: unknown): void;
  reset(): void;
}

export interface IKeyBinding<TRow> {
  readonly key: string;
  readonly target: 'cell' | 'header';
  /** Returns true when the key was consumed. */
  run(kernel: ITableKernel<TRow, unknown>): boolean;
}

/** Everything an extension hands the kernel. Every field is optional; the kernel composes what is there. */
export interface IExtensionInstance<TRow, TSlice> {
  readonly slice: TSlice;
  query?(): Partial<IRowQuery>;
  readonly pipeline?: IPipelineStage<TRow>;
  readonly state?: IStateSlice;
  readonly columns?: readonly TAnyColumn<TRow>[];
  rowExtent?(rowKey: string): number;
  /** Derived rows stuck above or below the body, after the application's own pinned rows. */
  pinnedRows?(side: 'top' | 'bottom'): readonly TDisplayRow<TRow>[];
  readonly keys?: readonly IKeyBinding<TRow>[];
  menu?(context: IMenuContext<TRow>): readonly TMenuItem[];
  readonly guards?: TGuards<ITableCommands>;
  /** Contributions to view slots; the view adapter types them. */
  readonly view?: Readonly<Record<string, unknown>>;
  readonly overrides?: Readonly<Record<string, unknown>>;
  dispose(): void;
}

export interface ITableExtension<TRow, TId extends string = string, TSlice = unknown> {
  readonly id: TId;
  readonly requires?: readonly string[];
  create(kernel: ITableKernel<TRow, unknown>): IExtensionInstance<TRow, TSlice>;
}
