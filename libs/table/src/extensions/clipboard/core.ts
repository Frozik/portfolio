import { makeAutoObservable } from 'mobx';

import type { TAnyColumn } from '../../core/columns/column';
import type { TCommandOutcome } from '../../core/kernel/command-bus';
import type { IExtensionInstance, IKeyBinding, ITableExtension } from '../../core/kernel/extension';
import type { ITableKernel } from '../../core/kernel/kernel';
import type { TSerializeFormat } from '../../core/rows/serialize';
import { cellText, serializeRows } from '../../core/rows/serialize';
import type { ICellBlock, ISelectionPort } from '../../core/selection/selection-port';
import { SELECTION_ID } from '../../core/selection/selection-port';

declare module '../../core/kernel/contracts' {
  interface ITableCommands {
    readonly 'clipboard.copy': { readonly text: string };
  }
  interface ITableEvents {
    readonly 'clipboard.copied': ICopyReport;
  }
}

export interface IClipboardPort {
  write(text: string): Promise<void> | void;
}

export interface IClipboardOptions {
  readonly port: IClipboardPort;
}

export interface ICopyOptions {
  readonly headers?: boolean;
  readonly format?: TSerializeFormat;
}

export interface ICopyReport {
  readonly rows: number;
  readonly cells: number;
  /** Rows that were not in memory and went out as empty text. */
  readonly unloaded: number;
}

export interface IClipboardSlice {
  readonly lastCopy: ICopyReport | undefined;
  /** What the selection describes: cell blocks, selected rows, or the focused cell. */
  copy(options?: ICopyOptions): TCommandOutcome;
  copyCell(): TCommandOutcome;
  /** The selected rows, or the focused one, as a whole. */
  copyRows(options?: ICopyOptions): TCommandOutcome;
}

const BLOCK_SEPARATOR = '\n\n';

class ClipboardSlice<TRow> implements IClipboardSlice {
  lastCopy: ICopyReport | undefined = undefined;

  constructor(
    private readonly kernel: ITableKernel<TRow, unknown>,
    private readonly port: IClipboardPort
  ) {
    makeAutoObservable<ClipboardSlice<TRow>, 'kernel' | 'port'>(
      this,
      { kernel: false, port: false },
      { autoBind: true }
    );
  }

  copy(options: ICopyOptions = {}): TCommandOutcome {
    const selection = this.selection;
    if (selection !== undefined && selection.mode.cells && selection.blocks.length > 0) {
      return this.copyBlocks(selection.blocks);
    }
    if (selection !== undefined && !selection.mode.cells && selection.count !== 0) {
      return this.copyRows(options);
    }
    return this.copyCell();
  }

  copyCell(): TCommandOutcome {
    const focused = this.kernel.focus.cell;
    const column =
      focused === undefined || focused === null
        ? undefined
        : this.kernel.columns.byId.get(focused.columnId);
    const row = focused === null ? undefined : this.loadedRow(focused.rowKey);
    if (column === undefined || row === undefined) {
      return { ok: false, reason: 'clipboard.nothingFocused' };
    }
    return this.write(cellText(row, column), { rows: 1, cells: 1, unloaded: 0 });
  }

  copyRows(options: ICopyOptions = {}): TCommandOutcome {
    const rows = this.rowsToCopy();
    if (rows.length === 0) {
      return { ok: false, reason: 'clipboard.nothingSelected' };
    }
    const columns = this.copiedColumns;
    const text = serializeRows(rows, columns, {
      format: options.format ?? 'tsv',
      headers: options.headers,
    });
    return this.write(text, {
      rows: rows.length,
      cells: rows.length * columns.length,
      unloaded: 0,
    });
  }

  private get selection(): ISelectionPort<TRow> | undefined {
    return this.kernel.extension<ISelectionPort<TRow>>(SELECTION_ID);
  }

  private get copiedColumns(): readonly TAnyColumn<TRow>[] {
    return this.kernel.columns.visible
      .filter(layout => !this.kernel.columns.isService(layout.id))
      .map(layout => layout.definition);
  }

  private rowsToCopy(): readonly TRow[] {
    const selected = this.selection?.selectedRows() ?? [];
    if (selected.length > 0) {
      return selected;
    }
    const focused = this.kernel.focus.cell;
    const row = focused === null ? undefined : this.loadedRow(focused.rowKey);
    return row === undefined ? [] : [row];
  }

  private loadedRow(rowKey: string): TRow | undefined {
    const index = this.kernel.rows.indexOf(rowKey);
    const displayRow = index === undefined ? undefined : this.kernel.rows.rowAt(index);
    return displayRow?.kind === 'leaf' ? displayRow.row : undefined;
  }

  private copyBlocks(blocks: readonly ICellBlock[]): TCommandOutcome {
    const { rows, columns } = this.kernel;
    let unloaded = 0;
    let cells = 0;
    let rowCount = 0;
    const texts = blocks.map(block => {
      const blockColumns = columns.visible
        .slice(block.left, block.right + 1)
        .filter(layout => !columns.isService(layout.id))
        .map(layout => layout.definition);
      const lines: string[] = [];
      for (let index = block.top; index <= block.bottom; index += 1) {
        const displayRow = rows.rowAt(index);
        rowCount += 1;
        cells += blockColumns.length;
        if (displayRow.kind !== 'leaf') {
          unloaded += 1;
          lines.push(blockColumns.map(() => '').join('\t'));
          continue;
        }
        lines.push(serializeRows([displayRow.row], blockColumns, { format: 'tsv' }));
      }
      return lines.join('\n');
    });
    return this.write(texts.join(BLOCK_SEPARATOR), { rows: rowCount, cells, unloaded });
  }

  private write(text: string, report: ICopyReport): TCommandOutcome {
    return this.kernel.commands.run('clipboard.copy', { text }, () => {
      void this.port.write(text);
      this.lastCopy = report;
      this.kernel.events.emit('clipboard.copied', report);
    });
  }
}

function clipboardKeys<TRow>(slice: IClipboardSlice): readonly IKeyBinding<TRow>[] {
  return [
    { key: 'Mod+c', target: 'cell', run: () => slice.copy().ok },
    { key: 'Mod+Shift+c', target: 'cell', run: () => slice.copyCell().ok },
  ];
}

export function clipboard<TRow = never>(
  options: IClipboardOptions
): ITableExtension<TRow, 'clipboard', IClipboardSlice> {
  return {
    id: 'clipboard',
    create(kernel): IExtensionInstance<TRow, IClipboardSlice> {
      const slice = new ClipboardSlice(kernel, options.port);
      return {
        slice,
        keys: clipboardKeys(slice),
        menu: ({ target }) =>
          target !== 'cell'
            ? []
            : [
                {
                  id: 'clipboard.copy',
                  label: 'menu.copy.selection',
                  section: 'clipboard',
                  run: () => void slice.copy(),
                },
                {
                  id: 'clipboard.copyWithHeaders',
                  label: 'menu.copy.withHeaders',
                  section: 'clipboard',
                  run: () => void slice.copyRows({ headers: true }),
                },
                {
                  id: 'clipboard.copyRow',
                  label: 'menu.copy.row',
                  section: 'clipboard',
                  run: () => void slice.copyRows(),
                },
                {
                  id: 'clipboard.copyCsv',
                  label: 'menu.copy.csv',
                  section: 'clipboard',
                  run: () => void slice.copyRows({ format: 'csv', headers: true }),
                },
                {
                  id: 'clipboard.copyJson',
                  label: 'menu.copy.json',
                  section: 'clipboard',
                  run: () => void slice.copyRows({ format: 'json' }),
                },
              ],
        dispose: () => undefined,
      };
    },
  };
}
