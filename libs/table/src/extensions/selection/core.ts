import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';

import type { ICellPosition } from '../../core/focus/focus-model';
import type { TBivariantCallback } from '../../core/kernel/callback';
import type { TCommandOutcome } from '../../core/kernel/command-bus';
import type { IExtensionInstance, ITableExtension } from '../../core/kernel/extension';
import type { ITableKernel } from '../../core/kernel/kernel';
import type { ICellBlock, ISelectionMode } from '../../core/selection/selection-port';
import { SELECTION_ID } from '../../core/selection/selection-port';
import { selectionColumn } from './column';
import type {
  ICellSelectionState,
  ISelectionOptions,
  ISelectionSlice,
  ISelectionState,
  ISelectionSummary,
  THeaderCheckboxState,
  TSelectOnClick,
} from './contracts';
import { selectionKeys } from './keys';
import type { ICellRange } from './ranges';
import { boundsOf, contains, edgesOf } from './ranges';
import type { IRowSelection } from './row-set';
import {
  ALL_ROWS,
  isEmptySelection,
  isRowSelected,
  NO_ROWS,
  selectedCount,
  withRow,
  withRows,
} from './row-set';

declare module '../../core/kernel/contracts' {
  interface ITableCommands {
    readonly 'selection.rows': { readonly selection: IRowSelection };
    readonly 'selection.ranges': { readonly ranges: readonly ICellRange[] };
    readonly 'selection.mode': { readonly mode: ISelectionMode };
  }
  interface ITableEvents {
    readonly 'selection.changed': {
      readonly rows: IRowSelection;
      readonly ranges: readonly ICellRange[];
    };
  }
}

class SelectionSlice<TRow> implements ISelectionSlice<TRow> {
  mode: ISelectionMode;
  rows: IRowSelection = NO_ROWS;
  anchor: string | null = null;
  ranges: readonly ICellRange[] = [];
  readonly selectOnClick: TSelectOnClick;
  readonly headerCheckbox: boolean;
  private readonly selectable: TBivariantCallback<[row: TRow], boolean> | undefined;

  constructor(
    private readonly kernel: ITableKernel<TRow, unknown>,
    options: ISelectionOptions<TRow>
  ) {
    this.mode = { rows: options.rows ?? 'single', cells: options.cells ?? false };
    this.selectOnClick = options.selectOnClick ?? 'row';
    this.headerCheckbox = options.headerCheckbox ?? true;
    this.selectable = options.selectable;
    makeAutoObservable<SelectionSlice<TRow>, 'kernel' | 'selectable' | 'leafKeysBetween'>(
      this,
      {
        kernel: false,
        selectable: false,
        isSelected: false,
        reasonAgainst: false,
        selectedRows: false,
        cellState: false,
        readState: false,
        leafKeysBetween: false,
      },
      { autoBind: true }
    );
  }

  get count(): number | undefined {
    return selectedCount(this.rows, this.kernel.rows.rowCount);
  }

  get headerState(): THeaderCheckboxState {
    if (isEmptySelection(this.rows)) {
      return 'none';
    }
    return this.rows.inverted && this.rows.keys.size === 0 ? 'all' : 'some';
  }

  get hasSelection(): boolean {
    return !isEmptySelection(this.rows) || this.ranges.length > 0;
  }

  private get columnIndexById(): ReadonlyMap<string, number> {
    return new Map(this.kernel.columns.visible.map((layout, index) => [layout.id, index]));
  }

  get blocks(): readonly ICellBlock[] {
    const resolver = {
      rowIndexOf: (rowKey: string) => this.kernel.rows.indexOf(rowKey),
      columnIndexOf: (columnId: string) => this.columnIndexById.get(columnId),
    };
    return this.ranges.flatMap(range => boundsOf(range, resolver) ?? []);
  }

  get summary(): ISelectionSummary | undefined {
    if (this.blocks.length === 0) {
      return undefined;
    }
    const rowIndexes = new Set<number>();
    let cells = 0;
    for (const block of this.blocks) {
      cells += (block.bottom - block.top + 1) * (block.right - block.left + 1);
      for (let index = block.top; index <= block.bottom; index += 1) {
        rowIndexes.add(index);
      }
    }
    return { cells, rows: rowIndexes.size };
  }

  setMode(mode: Partial<ISelectionMode>): TCommandOutcome {
    const next = { ...this.mode, ...mode };
    return this.kernel.commands.run('selection.mode', { mode: next }, () => {
      this.mode = next;
      this.commit(NO_ROWS, []);
    });
  }

  isSelected(rowKey: string): boolean {
    return this.mode.rows !== 'none' && isRowSelected(this.rows, rowKey);
  }

  reasonAgainst(rowKey: string): string | undefined {
    if (this.mode.rows === 'none') {
      return 'selection.rowsOff';
    }
    const index = this.kernel.rows.indexOf(rowKey);
    const displayRow = isNil(index) ? undefined : this.kernel.rows.rowAt(index);
    if (displayRow?.kind !== 'leaf') {
      return 'selection.notLoaded';
    }
    if (this.selectable?.(displayRow.row) === false) {
      return 'selection.notSelectable';
    }
    return this.kernel.commands.reasonAgainst('selection.rows', { selection: this.rows });
  }

  selectedRows(): readonly TRow[] {
    const source = this.kernel.rows;
    const rowCount = source.rowCount ?? 0;
    const result: TRow[] = [];
    for (let index = 0; index < rowCount; index += 1) {
      const displayRow = source.rowAt(index);
      if (displayRow.kind === 'leaf' && this.isSelected(displayRow.key)) {
        result.push(displayRow.row);
      }
    }
    return result;
  }

  toggle(rowKey: string): TCommandOutcome {
    const selected = !this.isSelected(rowKey);
    if (this.mode.rows === 'single') {
      return this.setRows(selected ? withRow(NO_ROWS, rowKey, true) : NO_ROWS, rowKey);
    }
    return this.setRows(withRow(this.rows, rowKey, selected), rowKey);
  }

  select(rowKey: string): TCommandOutcome {
    return this.setRows(withRow(NO_ROWS, rowKey, true), rowKey);
  }

  range(toKey: string, options: { readonly add?: boolean } = {}): TCommandOutcome {
    if (this.mode.rows !== 'multiple' || this.anchor === null) {
      return this.select(toKey);
    }
    const keys = this.leafKeysBetween(this.anchor, toKey);
    const base = options.add === true ? this.rows : NO_ROWS;
    return this.setRows(withRows(base, keys, true), this.anchor);
  }

  selectAll(): TCommandOutcome {
    if (this.mode.rows !== 'multiple') {
      return { ok: false, reason: 'selection.notMultiple' };
    }
    return this.setRows(ALL_ROWS, this.anchor);
  }

  clear(): TCommandOutcome {
    return this.kernel.commands.run('selection.rows', { selection: NO_ROWS }, () => {
      this.anchor = null;
      this.commit(NO_ROWS, []);
    });
  }

  cellState(rowKey: string, columnId: string): ICellSelectionState {
    if (!this.mode.cells || this.blocks.length === 0) {
      return { selected: false, edges: undefined };
    }
    const rowIndex = this.kernel.rows.indexOf(rowKey);
    const columnIndex = this.columnIndexById.get(columnId);
    if (isNil(rowIndex) || isNil(columnIndex)) {
      return { selected: false, edges: undefined };
    }
    const block = this.blocks.find(candidate => contains(candidate, rowIndex, columnIndex));
    if (block === undefined) {
      return { selected: false, edges: undefined };
    }
    const edges = edgesOf(block, rowIndex, columnIndex);
    const onEdge = edges.top || edges.bottom || edges.left || edges.right;
    return { selected: true, edges: onEdge ? edges : undefined };
  }

  startRange(position: ICellPosition, options: { readonly add?: boolean } = {}): TCommandOutcome {
    const range = { anchor: position, focus: position };
    return this.setRanges(options.add === true ? [...this.ranges, range] : [range]);
  }

  extendRange(position: ICellPosition): TCommandOutcome {
    const last = this.ranges.at(-1);
    if (last === undefined) {
      return this.startRange(position);
    }
    return this.setRanges([...this.ranges.slice(0, -1), { anchor: last.anchor, focus: position }]);
  }

  selectAllCells(): TCommandOutcome {
    const { rows, columns } = this.kernel;
    const rowCount = rows.rowCount ?? 0;
    const first = columns.visible.at(0);
    const last = columns.visible.at(-1);
    if (rowCount === 0 || first === undefined || last === undefined) {
      return { ok: false, reason: 'selection.empty' };
    }
    return this.setRanges([
      {
        anchor: { rowKey: rows.keyAt(0), columnId: first.id },
        focus: { rowKey: rows.keyAt(rowCount - 1), columnId: last.id },
      },
    ]);
  }

  readState(): ISelectionState {
    return {
      mode: this.mode,
      rows: { inverted: this.rows.inverted, keys: [...this.rows.keys] },
    };
  }

  writeState(state: ISelectionState, withRows: boolean): void {
    this.mode = state.mode;
    const rows =
      withRows && state.rows !== undefined
        ? { inverted: state.rows.inverted, keys: new Set(state.rows.keys) }
        : NO_ROWS;
    this.commit(rows, []);
  }

  private setRows(selection: IRowSelection, anchor: string | null): TCommandOutcome {
    if (this.mode.rows === 'none') {
      return { ok: false, reason: 'selection.rowsOff' };
    }
    if (anchor !== null && !isRowSelected(this.rows, anchor)) {
      const reason = this.reasonAgainst(anchor);
      if (reason !== undefined) {
        return { ok: false, reason };
      }
    }
    return this.kernel.commands.run('selection.rows', { selection }, () => {
      this.anchor = anchor;
      this.commit(selection, this.ranges);
    });
  }

  private setRanges(ranges: readonly ICellRange[]): TCommandOutcome {
    if (!this.mode.cells) {
      return { ok: false, reason: 'selection.cellsOff' };
    }
    return this.kernel.commands.run('selection.ranges', { ranges }, () => {
      this.commit(this.rows, ranges);
    });
  }

  private commit(rows: IRowSelection, ranges: readonly ICellRange[]): void {
    this.rows = rows;
    this.ranges = ranges;
    this.kernel.events.emit('selection.changed', { rows, ranges });
  }

  private leafKeysBetween(fromKey: string, toKey: string): readonly string[] {
    const source = this.kernel.rows;
    const from = source.indexOf(fromKey);
    const to = source.indexOf(toKey);
    if (isNil(from) || isNil(to)) {
      return [toKey];
    }
    const keys: string[] = [];
    for (let index = Math.min(from, to); index <= Math.max(from, to); index += 1) {
      const displayRow = source.rowAt(index);
      if (displayRow.kind === 'leaf' && this.selectable?.(displayRow.row) !== false) {
        keys.push(displayRow.key);
      }
    }
    return keys;
  }
}

export function selection<TRow = never>(
  options: ISelectionOptions<TRow> = {}
): ITableExtension<TRow, typeof SELECTION_ID, ISelectionSlice<TRow>> {
  return {
    id: SELECTION_ID,
    create(kernel): IExtensionInstance<TRow, ISelectionSlice<TRow>> {
      const slice = new SelectionSlice(kernel, options);
      return {
        slice,
        columns: options.checkboxes === true ? [selectionColumn(slice)] : undefined,
        keys: selectionKeys(slice),
        menu: ({ target }) =>
          target !== 'cell'
            ? []
            : [
                {
                  id: 'selection.selectAll',
                  label: 'menu.selection.all',
                  section: 'selection',
                  disabled: slice.mode.cells ? false : slice.mode.rows !== 'multiple',
                  run: () => void (slice.mode.cells ? slice.selectAllCells() : slice.selectAll()),
                },
                {
                  id: 'selection.clear',
                  label: 'menu.selection.clear',
                  section: 'selection',
                  disabled: !slice.hasSelection,
                  run: () => void slice.clear(),
                },
              ],
        state: {
          read: () => {
            const state = slice.readState();
            return options.persistSelection === true ? state : { mode: state.mode };
          },
          write: value =>
            slice.writeState(value as ISelectionState, options.persistSelection === true),
          reset: () => slice.clear(),
        },
        dispose: () => undefined,
      };
    },
  };
}
