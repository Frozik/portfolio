import { makeAutoObservable } from 'mobx';

import type { TAnyColumn } from '../../core/columns/column';
import type { TCommandOutcome } from '../../core/kernel/command-bus';
import type { IExtensionInstance, ITableExtension } from '../../core/kernel/extension';
import type { ITableKernel } from '../../core/kernel/kernel';
import type { TSerializeFormat } from '../../core/rows/serialize';
import { serializeRows } from '../../core/rows/serialize';
import type { ISelectionPort } from '../../core/selection/selection-port';
import { SELECTION_ID } from '../../core/selection/selection-port';

declare module '../../core/columns/column' {
  interface IColumnDefinition<TRow, TValue> {
    /** `false` keeps the column out of every export; the clipboard still copies it. */
    readonly exportable?: boolean;
  }
}

declare module '../../core/kernel/contracts' {
  interface ITableCommands {
    readonly 'export.download': { readonly filename: string; readonly format: TSerializeFormat };
  }
}

export interface IDownloadPort {
  download(filename: string, text: string, mimeType: string): void;
}

export interface IExportOptions {
  readonly scope?: 'all' | 'selected';
  readonly headers?: boolean;
  readonly delimiter?: string;
  /** Column ids in the wanted order; the visible columns otherwise. */
  readonly columns?: readonly string[];
}

export type TExportResult =
  | { readonly ok: true; readonly text: string; readonly rows: number }
  | { readonly ok: false; readonly reason: string };

export interface IExportSlice {
  reasonAgainst(options?: IExportOptions): string | undefined;
  serialize(format: TSerializeFormat, options?: IExportOptions): TExportResult;
  download(filename: string, format: TSerializeFormat, options?: IExportOptions): TCommandOutcome;
}

const MIME_TYPES: Readonly<Record<TSerializeFormat, string>> = {
  csv: 'text/csv;charset=utf-8',
  tsv: 'text/tab-separated-values;charset=utf-8',
  json: 'application/json;charset=utf-8',
};

class ExportSlice<TRow> implements IExportSlice {
  constructor(
    private readonly kernel: ITableKernel<TRow, unknown>,
    private readonly port: IDownloadPort | undefined
  ) {
    makeAutoObservable<ExportSlice<TRow>, 'kernel' | 'port'>(
      this,
      { kernel: false, port: false, reasonAgainst: false, serialize: false },
      { autoBind: true }
    );
  }

  reasonAgainst(options: IExportOptions = {}): string | undefined {
    const scope = options.scope ?? 'all';
    if (scope === 'all' && (this.kernel.rows.hasMore || this.kernel.rows.rowCount === undefined)) {
      return 'export.partialData';
    }
    if (scope === 'selected' && (this.selection?.count ?? 0) === 0) {
      return 'export.nothingSelected';
    }
    return undefined;
  }

  serialize(format: TSerializeFormat, options: IExportOptions = {}): TExportResult {
    const reason = this.reasonAgainst(options);
    if (reason !== undefined) {
      return { ok: false, reason };
    }
    const rows =
      options.scope === 'selected' ? (this.selection?.selectedRows() ?? []) : this.allRows();
    const text = serializeRows(rows, this.exportedColumns(options.columns), {
      format,
      headers: options.headers ?? true,
      delimiter: options.delimiter,
    });
    return { ok: true, text, rows: rows.length };
  }

  download(
    filename: string,
    format: TSerializeFormat,
    options: IExportOptions = {}
  ): TCommandOutcome {
    if (this.port === undefined) {
      return { ok: false, reason: 'export.noDownloadPort' };
    }
    const result = this.serialize(format, options);
    if (!result.ok) {
      return result;
    }
    const port = this.port;
    return this.kernel.commands.run('export.download', { filename, format }, () => {
      port.download(filename, result.text, MIME_TYPES[format]);
    });
  }

  private get selection(): ISelectionPort<TRow> | undefined {
    return this.kernel.extension<ISelectionPort<TRow>>(SELECTION_ID);
  }

  private allRows(): readonly TRow[] {
    const source = this.kernel.rows;
    const rows: TRow[] = [];
    for (let index = 0; index < (source.rowCount ?? 0); index += 1) {
      const displayRow = source.rowAt(index);
      if (displayRow.kind === 'leaf') {
        rows.push(displayRow.row);
      }
    }
    return rows;
  }

  private exportedColumns(ids: readonly string[] | undefined): readonly TAnyColumn<TRow>[] {
    const { columns } = this.kernel;
    const chosen =
      ids === undefined
        ? columns.visible.map(layout => layout.definition)
        : ids.flatMap(id => columns.byId.get(id) ?? []);
    return chosen.filter(column => column.exportable !== false && !columns.isService(column.id));
  }
}

export function exporting<TRow = never>(
  options: { readonly port?: IDownloadPort } = {}
): ITableExtension<TRow, 'export', IExportSlice> {
  return {
    id: 'export',
    create(kernel): IExtensionInstance<TRow, IExportSlice> {
      const slice = new ExportSlice(kernel, options.port);
      const filename = (): string => `${kernel.id ?? 'table'}.csv`;
      return {
        slice,
        menu: () => [
          {
            id: 'export.csv',
            label: 'menu.export.csv',
            section: 'export',
            disabled: slice.reasonAgainst() ?? false,
            run: () => void slice.download(filename(), 'csv'),
          },
          {
            id: 'export.selectedCsv',
            label: 'menu.export.selectedCsv',
            section: 'export',
            disabled: slice.reasonAgainst({ scope: 'selected' }) ?? false,
            run: () => void slice.download(filename(), 'csv', { scope: 'selected' }),
          },
        ],
        dispose: () => undefined,
      };
    },
  };
}
