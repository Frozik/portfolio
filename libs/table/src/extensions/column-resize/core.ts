import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';

import { DEFAULT_MIN_COLUMN_WIDTH } from '../../core/columns/column-widths';
import type { TCommandOutcome } from '../../core/kernel/command-bus';
import type { IExtensionInstance, ITableExtension } from '../../core/kernel/extension';
import type { ITableKernel } from '../../core/kernel/kernel';

export const DEFAULT_AUTOSIZE_MAX_WIDTH = 400;

/**
 * When the columns without a `width` of their own fit their content:
 * `header` once by the header alone, `firstData` once by the header and the
 * first rows, `fit` on every change growing and shrinking, `grow` on every
 * change growing only, `off` never. A column with `width`, `flex`, `wrap` or
 * a width the user dragged is left alone; the result stays between the
 * column's `minWidth` and `maxWidth`.
 */
export type TAutoSizeMode = 'off' | 'header' | 'firstData' | 'fit' | 'grow';

export interface IColumnMeasure {
  /** The header's content, in px, including the cell padding. */
  readonly header: number;
  /** The widest rendered cell, in px, including the cell padding; `undefined` while no row of it is rendered. */
  readonly content: number | undefined;
}

export interface IMeasurePort {
  measureColumn(columnId: string): IColumnMeasure | undefined;
}

export interface IColumnResizeOptions {
  readonly autoSize?: TAutoSizeMode;
  /** The ceiling of an automatic pass for a column without `maxWidth`; an explicit request is not capped. */
  readonly autoSizeMaxWidth?: number;
}

export interface IColumnResizeSlice {
  readonly resizing: string | null;
  readonly autoSizeMode: TAutoSizeMode;
  resize(columnId: string, width: number): TCommandOutcome;
  beginResize(columnId: string): void;
  endResize(): void;
  /** Fits the columns to their content on request; an explicit request is not capped. */
  autoSize(columnIds?: readonly string[], options?: { readonly cap?: boolean }): void;
  /** One automatic pass under the current mode; the view calls it whenever the rendered content may have changed. */
  autoSizePass(): void;
  setAutoSizeMode(mode: TAutoSizeMode): void;
  reasonAgainst(columnId: string): string | undefined;
  attachMeasurePort(port: IMeasurePort | undefined): void;
}

class ColumnResizeSlice<TRow> implements IColumnResizeSlice {
  resizing: string | null = null;
  autoSizeMode: TAutoSizeMode;
  private measurePort: IMeasurePort | undefined = undefined;
  private readonly autoSizeMaxWidth: number;
  /** Columns a once-mode has sized; a column that appears later gets its own pass. */
  private readonly sized = new Set<string>();

  constructor(
    private readonly kernel: ITableKernel<TRow, unknown>,
    options: IColumnResizeOptions
  ) {
    this.autoSizeMode = options.autoSize ?? 'grow';
    this.autoSizeMaxWidth = options.autoSizeMaxWidth ?? DEFAULT_AUTOSIZE_MAX_WIDTH;
    makeAutoObservable<
      ColumnResizeSlice<TRow>,
      'kernel' | 'measurePort' | 'autoSizeMaxWidth' | 'sized' | 'autoSizable' | 'clamp'
    >(
      this,
      {
        kernel: false,
        measurePort: false,
        autoSizeMaxWidth: false,
        sized: false,
        reasonAgainst: false,
        autoSizable: false,
        clamp: false,
      },
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

  setAutoSizeMode(mode: TAutoSizeMode): void {
    this.autoSizeMode = mode;
    this.sized.clear();
  }

  autoSize(columnIds?: readonly string[], options: { readonly cap?: boolean } = {}): void {
    if (isNil(this.measurePort)) {
      return;
    }
    const ids = columnIds ?? this.kernel.columns.visibleIds;
    for (const columnId of ids) {
      const definition = this.kernel.columns.byId.get(columnId);
      const measure = this.measurePort.measureColumn(columnId);
      if (definition === undefined || measure === undefined) {
        continue;
      }
      const measured = Math.max(measure.header, measure.content ?? 0);
      const target =
        definition.width ??
        (options.cap === false ? measured : Math.min(measured, this.autoSizeMaxWidth));
      this.kernel.columns.resize(columnId, target, 'auto');
    }
  }

  autoSizePass(): void {
    const port = this.measurePort;
    const mode = this.autoSizeMode;
    if (isNil(port) || mode === 'off') {
      return;
    }
    const once = mode === 'header' || mode === 'firstData';
    for (const layout of this.kernel.columns.visible) {
      if ((once && this.sized.has(layout.id)) || !this.autoSizable(layout.id)) {
        continue;
      }
      const measure = port.measureColumn(layout.id);
      if (measure === undefined || (mode !== 'header' && measure.content === undefined)) {
        continue;
      }
      const target = this.clamp(
        layout.id,
        mode === 'header' ? measure.header : Math.max(measure.header, measure.content ?? 0)
      );
      if (once) {
        this.sized.add(layout.id);
      }
      if (target === layout.width || (mode === 'grow' && target < layout.width)) {
        continue;
      }
      this.kernel.columns.resize(layout.id, target, 'auto');
    }
  }

  attachMeasurePort(port: IMeasurePort | undefined): void {
    this.measurePort = port;
  }

  /** A column sizes itself unless something else owns its width: a declared `width` or `flex`, wrapping, or the user's drag. */
  private autoSizable(columnId: string): boolean {
    const definition = this.kernel.columns.byId.get(columnId);
    const state = this.kernel.columns.stateOf(columnId);
    return (
      definition !== undefined &&
      definition.width === undefined &&
      this.kernel.columns.flexOf(columnId) === undefined &&
      definition.wrap !== true &&
      state.widthBy !== 'user' &&
      this.reasonAgainst(columnId) === undefined
    );
  }

  private clamp(columnId: string, width: number): number {
    const definition = this.kernel.columns.byId.get(columnId);
    const min = definition?.minWidth ?? DEFAULT_MIN_COLUMN_WIDTH;
    const max = definition?.maxWidth ?? this.autoSizeMaxWidth;
    // Whole pixels, rounded up: a box half a pixel short of its text already shows an ellipsis.
    return Math.ceil(Math.min(max, Math.max(min, width)));
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
