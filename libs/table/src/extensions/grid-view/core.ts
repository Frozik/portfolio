import { isNil } from 'lodash-es';
import { computed, makeAutoObservable, reaction } from 'mobx';

import { DisposableBag } from '@frozik/utils/disposable/DisposableBag';

import type { IColumnLayout } from '../../core/columns/columns-model';
import type { IExtensionInstance, ITableExtension } from '../../core/kernel/extension';
import type { ITableKernel } from '../../core/kernel/kernel';
import type { TDisplayRow } from '../../core/rows/display-row';
import type { IColumnWindow } from './column-window';
import { columnWindow } from './column-window';
import type { VirtualWindow } from './virtual-window';
import { rowOffsets, virtualWindowFromOffsets } from './virtual-window';

export const DEFAULT_ROW_HEIGHT = 32;
/** Browsers cap an element's height around 17–33 million pixels; taller feeds scroll through a scale. */
export const MAX_SCROLL_HEIGHT = 12_000_000;
const DEFAULT_OVERSCAN_ROWS = 6;
const DEFAULT_OVERSCAN_COLUMNS = 2;
const DEFAULT_MAX_CONTENT_ROWS = 50;

export type TRowHeight<TRow> = number | 'auto' | ((row: TRow) => number);

export interface IGridViewOptions<TRow> {
  readonly rowHeight?: TRowHeight<TRow>;
  readonly overscanRows?: number;
  readonly overscanColumns?: number;
  readonly layout?: 'fill' | 'content';
  readonly maxRows?: number;
  readonly header?: boolean;
  readonly virtualizeColumns?: boolean;
}

export interface IViewportGeometry {
  readonly width: number | undefined;
  readonly height: number;
  readonly scrollTop: number;
  readonly scrollLeft: number;
}

export interface IRenderedRow<TRow> {
  readonly index: number;
  readonly key: string;
  readonly row: TDisplayRow<TRow>;
  readonly height: number;
}

export interface IScrollPort {
  scrollTo(position: { readonly top?: number; readonly left?: number }): void;
}

/**
 * Every scroll frame replaces the viewport, so the windows derived from it
 * compare by content: rows and cells re-render only when a window moves,
 * not on every pixel.
 */
function sameRowWindow(left: VirtualWindow, right: VirtualWindow): boolean {
  return (
    left.startIndex === right.startIndex &&
    left.endIndex === right.endIndex &&
    left.offsetBefore === right.offsetBefore &&
    left.offsetAfter === right.offsetAfter &&
    left.totalHeight === right.totalHeight
  );
}

function sameColumnWindow<TRow>(left: IColumnWindow<TRow>, right: IColumnWindow<TRow>): boolean {
  return (
    left.leftSpacer === right.leftSpacer &&
    left.rightSpacer === right.rightSpacer &&
    left.columns.length === right.columns.length &&
    left.columns.every((layout, index) => layout === right.columns[index])
  );
}

function sameRenderedRows<TRow>(
  left: readonly IRenderedRow<TRow>[],
  right: readonly IRenderedRow<TRow>[]
): boolean {
  return (
    left.length === right.length &&
    left.every((rendered, index) => {
      const other = right[index];
      return (
        rendered.index === other.index &&
        rendered.key === other.key &&
        rendered.row === other.row &&
        rendered.height === other.height
      );
    })
  );
}

/** What only the DOM knows — viewport, scroll, measured heights — and the windows derived from it. */
export class GridViewSlice<TRow> {
  viewport: IViewportGeometry = { width: undefined, height: 0, scrollTop: 0, scrollLeft: 0 };
  readonly header: boolean;
  readonly layout: 'fill' | 'content';
  readonly maxRows: number;
  private measured = new Map<string, number>();
  /** The rendered header block, filter and group rows included; pinned rows stick below it. */
  headerHeight: number | undefined = undefined;
  private scrollPort: IScrollPort | undefined = undefined;
  private readonly rowHeight: TRowHeight<TRow>;
  private readonly overscanRows: number;
  private readonly overscanColumns: number;
  private readonly virtualizeColumns: boolean;
  private readonly disposers = new DisposableBag();
  private lastRendered: ReadonlyMap<string, IRenderedRow<TRow>> = new Map();
  private readonly rowWindowBox = computed(() => this.computeRowWindow(), {
    equals: sameRowWindow,
  });
  private readonly columnsBox = computed(() => this.computeColumns(), { equals: sameColumnWindow });
  private readonly renderedRowsBox = computed(() => this.computeRenderedRows(), {
    equals: sameRenderedRows,
  });

  constructor(
    private readonly kernel: ITableKernel<TRow, unknown>,
    options: IGridViewOptions<TRow>
  ) {
    this.rowHeight = options.rowHeight ?? DEFAULT_ROW_HEIGHT;
    this.overscanRows = options.overscanRows ?? DEFAULT_OVERSCAN_ROWS;
    this.overscanColumns = options.overscanColumns ?? DEFAULT_OVERSCAN_COLUMNS;
    this.layout = options.layout ?? 'fill';
    this.maxRows = options.maxRows ?? DEFAULT_MAX_CONTENT_ROWS;
    this.header = options.header ?? true;
    this.virtualizeColumns = options.virtualizeColumns ?? true;
    makeAutoObservable<
      GridViewSlice<TRow>,
      | 'kernel'
      | 'scrollPort'
      | 'rowHeight'
      | 'overscanRows'
      | 'overscanColumns'
      | 'virtualizeColumns'
      | 'disposers'
      | 'ownHeightOf'
      | 'rowWindowBox'
      | 'columnsBox'
      | 'renderedRowsBox'
      | 'lastRendered'
      | 'computeRowWindow'
      | 'computeColumns'
      | 'computeRenderedRows'
    >(
      this,
      {
        kernel: false,
        scrollPort: false,
        rowHeight: false,
        overscanRows: false,
        overscanColumns: false,
        virtualizeColumns: false,
        disposers: false,
        rowHeightAt: false,
        ownHeightOf: false,
        rowWindow: false,
        columns: false,
        renderedRows: false,
        rowWindowBox: false,
        columnsBox: false,
        renderedRowsBox: false,
        lastRendered: false,
        computeRowWindow: false,
        computeColumns: false,
        computeRenderedRows: false,
      },
      { autoBind: true }
    );
    this.disposers.add(
      reaction(
        () => this.rowWindow,
        window =>
          this.kernel.rows.setRange({
            start: window.startIndex,
            end: window.endIndex + 1,
          }),
        { fireImmediately: true }
      )
    );
  }

  setViewport(geometry: IViewportGeometry): void {
    this.viewport = geometry;
    this.kernel.columns.setViewportWidth(geometry.width);
  }

  measureHeader(height: number): void {
    this.headerHeight = height;
  }

  measure(rowKey: string, height: number): void {
    if (this.measured.get(rowKey) !== height) {
      this.measured.set(rowKey, height);
    }
  }

  attachScrollPort(port: IScrollPort | undefined): void {
    this.scrollPort = port;
  }

  get measuresRows(): boolean {
    return this.rowHeight === 'auto';
  }

  get rowCount(): number {
    return this.kernel.rows.rowCount ?? 0;
  }

  rowHeightAt(index: number): number {
    const displayRow = this.kernel.rows.rowAt(index);
    return this.ownHeightOf(displayRow) + this.kernel.rowExtent(displayRow.key);
  }

  private ownHeightOf(displayRow: TDisplayRow<TRow>): number {
    if (typeof this.rowHeight === 'number') {
      return this.rowHeight;
    }
    if (this.rowHeight === 'auto') {
      return this.measured.get(displayRow.key) ?? DEFAULT_ROW_HEIGHT;
    }
    return displayRow.kind === 'leaf' ? this.rowHeight(displayRow.row) : DEFAULT_ROW_HEIGHT;
  }

  private get heights(): readonly number[] {
    return Array.from({ length: this.rowCount }, (_, index) => this.rowHeightAt(index));
  }

  private get offsets(): readonly number[] {
    return rowOffsets(this.heights);
  }

  /** 1 while the rows fit the browser's height limit; smaller when the scrollbar stands for more pixels than it can show. */
  get scrollScale(): number {
    const total = this.offsets[this.rowCount] ?? 0;
    return total > MAX_SCROLL_HEIGHT ? MAX_SCROLL_HEIGHT / total : 1;
  }

  /** The scroll position in row pixels, whatever the scrollbar's own range is. */
  private get virtualScrollTop(): number {
    return this.viewport.scrollTop / this.scrollScale;
  }

  get rowWindow(): VirtualWindow {
    return this.rowWindowBox.get();
  }

  private computeRowWindow(): VirtualWindow {
    return virtualWindowFromOffsets({
      offsets: this.offsets,
      scrollTop: this.virtualScrollTop,
      viewportHeight: this.viewport.height,
      overscan: this.overscanRows,
    });
  }

  /** Height of every row together, in row pixels. */
  get totalHeight(): number {
    return this.rowWindow.totalHeight;
  }

  get scrolledX(): boolean {
    return this.viewport.scrollLeft > 0;
  }

  /** What the scroll container's body is sized to: the total, or the browser's limit when scaled. */
  get scrollHeight(): number {
    return Math.round(this.totalHeight * this.scrollScale);
  }

  /** Where the rendered rows start inside the body: the window's offset, corrected for the scale. */
  get rowsOffset(): number {
    return this.rowWindow.offsetBefore - this.virtualScrollTop + this.viewport.scrollTop;
  }

  get renderedRows(): readonly IRenderedRow<TRow>[] {
    return this.renderedRowsBox.get();
  }

  /** Rows that did not change keep their object, so React's memo skips them when the window merely shifts. */
  private computeRenderedRows(): readonly IRenderedRow<TRow>[] {
    const { startIndex, endIndex } = this.rowWindow;
    const previous = this.lastRendered;
    const rows: IRenderedRow<TRow>[] = [];
    for (let index = startIndex; index <= endIndex; index += 1) {
      const row = this.kernel.rows.rowAt(index);
      const height = this.rowHeightAt(index);
      const known = previous.get(row.key);
      rows.push(
        known !== undefined && known.index === index && known.row === row && known.height === height
          ? known
          : { index, key: row.key, row, height }
      );
    }
    this.lastRendered = new Map(rows.map(rendered => [rendered.key, rendered]));
    return rows;
  }

  get columns(): IColumnWindow<TRow> {
    return this.columnsBox.get();
  }

  private computeColumns(): IColumnWindow<TRow> {
    const visible = this.kernel.columns.visible;
    if (!this.virtualizeColumns) {
      return { columns: visible, leftSpacer: 0, rightSpacer: 0 };
    }
    return columnWindow(
      visible,
      this.viewport.scrollLeft,
      this.viewport.width,
      this.overscanColumns
    );
  }

  /** Height the table asks for in `content` layout: every row up to `maxRows`. */
  get contentRowsHeight(): number {
    return this.offsets[Math.min(this.maxRows, this.rowCount)] ?? 0;
  }

  scrollToRow(index: number): void {
    if (isNil(this.scrollPort)) {
      return;
    }
    const { startIndex, endIndex } = this.rowWindow;
    if (index >= startIndex + this.overscanRows && index <= endIndex - this.overscanRows) {
      return;
    }
    this.scrollPort.scrollTo({ top: (this.offsets[index] ?? 0) * this.scrollScale });
  }

  scrollToColumn(layout: IColumnLayout<TRow>): void {
    if (isNil(this.scrollPort) || layout.section !== 'center') {
      return;
    }
    this.scrollPort.scrollTo({ left: layout.offset });
  }

  dispose(): void {
    this.disposers.disposeAll();
  }
}

export function gridView<TRow = never>(
  options: IGridViewOptions<TRow> = {}
): ITableExtension<TRow, 'gridView', GridViewSlice<TRow>> {
  return {
    id: 'gridView',
    create(kernel): IExtensionInstance<TRow, GridViewSlice<TRow>> {
      const slice = new GridViewSlice(kernel, options);
      return { slice, dispose: slice.dispose };
    },
  };
}
