import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';

import type { TCommandOutcome } from '../../core/kernel/command-bus';
import type { IExtensionInstance, ITableExtension } from '../../core/kernel/extension';
import type { ITableKernel } from '../../core/kernel/kernel';

export const DEFAULT_AUTOSIZE_MAX_WIDTH = 400;

export interface IMeasurePort {
  /** Widest rendered content of the column, in px, or `undefined` when nothing of it is rendered. */
  measureColumn(columnId: string): number | undefined;
}

export interface IColumnResizeOptions {
  readonly autoSizeMaxWidth?: number;
}

export interface IColumnResizeSlice {
  readonly resizing: string | null;
  resize(columnId: string, width: number): TCommandOutcome;
  beginResize(columnId: string): void;
  endResize(): void;
  /** Fits the columns to their content; an explicit request is not capped. */
  autoSize(columnIds?: readonly string[], options?: { readonly cap?: boolean }): void;
  reasonAgainst(columnId: string): string | undefined;
  attachMeasurePort(port: IMeasurePort | undefined): void;
}

class ColumnResizeSlice<TRow> implements IColumnResizeSlice {
  resizing: string | null = null;
  private measurePort: IMeasurePort | undefined = undefined;
  private readonly autoSizeMaxWidth: number;

  constructor(
    private readonly kernel: ITableKernel<TRow, unknown>,
    options: IColumnResizeOptions
  ) {
    this.autoSizeMaxWidth = options.autoSizeMaxWidth ?? DEFAULT_AUTOSIZE_MAX_WIDTH;
    makeAutoObservable<ColumnResizeSlice<TRow>, 'kernel' | 'measurePort' | 'autoSizeMaxWidth'>(
      this,
      { kernel: false, measurePort: false, autoSizeMaxWidth: false, reasonAgainst: false },
      { autoBind: true }
    );
  }

  resize(columnId: string, width: number): TCommandOutcome {
    return this.kernel.columns.resize(columnId, width, 'user');
  }

  beginResize(columnId: string): void {
    this.resizing = columnId;
  }

  endResize(): void {
    this.resizing = null;
  }

  reasonAgainst(columnId: string): string | undefined {
    return this.kernel.commands.reasonAgainst('columns.resize', { columnId, width: 0 });
  }

  autoSize(columnIds?: readonly string[], options: { readonly cap?: boolean } = {}): void {
    if (isNil(this.measurePort)) {
      return;
    }
    const ids = columnIds ?? this.kernel.columns.visibleIds;
    for (const columnId of ids) {
      const definition = this.kernel.columns.byId.get(columnId);
      const measured = this.measurePort.measureColumn(columnId);
      if (definition === undefined || measured === undefined) {
        continue;
      }
      const target =
        definition.width ??
        (options.cap === false ? measured : Math.min(measured, this.autoSizeMaxWidth));
      this.kernel.columns.resize(columnId, target, 'auto');
    }
  }

  attachMeasurePort(port: IMeasurePort | undefined): void {
    this.measurePort = port;
  }
}

export function columnResize<TRow = never>(
  options: IColumnResizeOptions = {}
): ITableExtension<TRow, 'columnResize', IColumnResizeSlice> {
  return {
    id: 'columnResize',
    create(kernel): IExtensionInstance<TRow, IColumnResizeSlice> {
      const slice = new ColumnResizeSlice(kernel, options);
      return {
        slice,
        menu: ({ target, columnId }) =>
          target !== 'header'
            ? []
            : [
                {
                  id: 'columnResize.autoSize',
                  label: 'menu.columns.autoSize',
                  section: 'columns',
                  disabled: columnId === undefined || (slice.reasonAgainst(columnId) ?? false),
                  run: () =>
                    slice.autoSize(columnId === undefined ? [] : [columnId], { cap: false }),
                },
                {
                  id: 'columnResize.autoSizeAll',
                  label: 'menu.columns.autoSizeAll',
                  section: 'columns',
                  run: () => slice.autoSize(),
                },
              ],
        dispose: () => undefined,
      };
    },
  };
}
