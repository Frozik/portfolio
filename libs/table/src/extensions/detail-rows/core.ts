import { isNil } from 'lodash-es';
import { makeAutoObservable } from 'mobx';

import type { TAnyColumn } from '../../core/columns/column';
import type { TBivariantCallback } from '../../core/kernel/callback';
import type { TCommandOutcome } from '../../core/kernel/command-bus';
import type { IExtensionInstance, IKeyBinding, ITableExtension } from '../../core/kernel/extension';
import type { ITableKernel } from '../../core/kernel/kernel';

declare module '../../core/kernel/contracts' {
  interface ITableCommands {
    readonly 'detail.toggle': { readonly rowKey: string; readonly expanded: boolean };
  }
  interface ITableEvents {
    readonly 'detail.changed': { readonly expanded: readonly string[] };
  }
}

export const DETAIL_COLUMN_ID = 'detail';
const DETAIL_COLUMN_WIDTH = 32;
const DEFAULT_DETAIL_HEIGHT = 160;

export type TExpandOn = 'click' | 'doubleClick' | 'none';

export interface IDetailRowsOptions<TRow> {
  /** Only one row open at a time. */
  readonly single?: boolean;
  readonly expandOn?: TExpandOn;
  readonly hasDetail?: TBivariantCallback<[row: TRow], boolean>;
  /** Measured from the rendered detail, or a fixed number of pixels. */
  readonly detailHeight?: 'auto' | number;
  readonly persistExpanded?: boolean;
}

export interface IDetailRowsSlice {
  readonly expanded: ReadonlySet<string>;
  readonly expandOn: TExpandOn;
  readonly measures: boolean;
  isExpanded(rowKey: string): boolean;
  reasonAgainst(rowKey: string): string | undefined;
  extentOf(rowKey: string): number;
  toggle(rowKey: string, expanded?: boolean): TCommandOutcome;
  collapseAll(): void;
  /** The rendered height of an open detail, in `auto` mode. */
  measure(rowKey: string, height: number): void;
}

class DetailRowsSlice<TRow> implements IDetailRowsSlice {
  expanded: ReadonlySet<string> = new Set();
  readonly expandOn: TExpandOn;
  private heights: ReadonlyMap<string, number> = new Map();
  private readonly detailHeight: 'auto' | number;
  private readonly hasDetail: TBivariantCallback<[row: TRow], boolean> | undefined;
  private readonly single: boolean;

  constructor(
    private readonly kernel: ITableKernel<TRow, unknown>,
    options: IDetailRowsOptions<TRow>
  ) {
    this.expandOn = options.expandOn ?? 'click';
    this.detailHeight = options.detailHeight ?? 'auto';
    this.hasDetail = options.hasDetail;
    this.single = options.single ?? false;
    makeAutoObservable<DetailRowsSlice<TRow>, 'kernel' | 'detailHeight' | 'hasDetail' | 'single'>(
      this,
      {
        kernel: false,
        detailHeight: false,
        hasDetail: false,
        single: false,
        isExpanded: false,
        reasonAgainst: false,
        extentOf: false,
        readState: false,
      },
      { autoBind: true }
    );
  }

  get measures(): boolean {
    return this.detailHeight === 'auto';
  }

  isExpanded(rowKey: string): boolean {
    return this.expanded.has(rowKey);
  }

  reasonAgainst(rowKey: string): string | undefined {
    const index = this.kernel.rows.indexOf(rowKey);
    const displayRow = isNil(index) ? undefined : this.kernel.rows.rowAt(index);
    if (displayRow?.kind !== 'leaf') {
      return 'detail.notLoaded';
    }
    if (this.hasDetail?.(displayRow.row) === false) {
      return 'detail.none';
    }
    return this.kernel.commands.reasonAgainst('detail.toggle', { rowKey, expanded: true });
  }

  extentOf(rowKey: string): number {
    if (!this.expanded.has(rowKey)) {
      return 0;
    }
    return this.detailHeight === 'auto'
      ? (this.heights.get(rowKey) ?? DEFAULT_DETAIL_HEIGHT)
      : this.detailHeight;
  }

  toggle(rowKey: string, expanded = !this.expanded.has(rowKey)): TCommandOutcome {
    if (expanded) {
      const reason = this.reasonAgainst(rowKey);
      if (reason !== undefined) {
        return { ok: false, reason };
      }
    }
    return this.kernel.commands.run('detail.toggle', { rowKey, expanded }, () => {
      const next = new Set(this.single && expanded ? [] : this.expanded);
      if (expanded) {
        next.add(rowKey);
      } else {
        next.delete(rowKey);
      }
      this.commit(next);
    });
  }

  collapseAll(): void {
    this.commit(new Set());
  }

  measure(rowKey: string, height: number): void {
    if (this.heights.get(rowKey) !== height) {
      this.heights = new Map([...this.heights, [rowKey, height]]);
    }
  }

  readState(): readonly string[] {
    return [...this.expanded];
  }

  writeState(expanded: readonly string[]): void {
    this.commit(new Set(expanded));
  }

  private commit(expanded: ReadonlySet<string>): void {
    this.expanded = expanded;
    this.kernel.events.emit('detail.changed', { expanded: [...expanded] });
  }
}

export function detailColumn<TRow>(): TAnyColumn<TRow> {
  return {
    id: DETAIL_COLUMN_ID,
    title: '',
    kind: 'custom',
    value: () => undefined,
    width: DETAIL_COLUMN_WIDTH,
    minWidth: DETAIL_COLUMN_WIDTH,
    maxWidth: DETAIL_COLUMN_WIDTH,
    align: 'center',
    interactive: true,
    lock: { pin: true, move: true, hide: true, resize: true },
  };
}

function detailKeys<TRow>(slice: IDetailRowsSlice): readonly IKeyBinding<TRow>[] {
  const onDetailColumn =
    (run: (rowKey: string) => boolean) =>
    (kernel: ITableKernel<TRow, unknown>): boolean => {
      const focused = kernel.focus.cell;
      return focused !== null && focused.columnId === DETAIL_COLUMN_ID && run(focused.rowKey);
    };
  return [
    {
      key: 'ArrowRight',
      target: 'cell',
      run: onDetailColumn(rowKey => !slice.isExpanded(rowKey) && slice.toggle(rowKey, true).ok),
    },
    {
      key: 'ArrowLeft',
      target: 'cell',
      run: onDetailColumn(rowKey => slice.isExpanded(rowKey) && slice.toggle(rowKey, false).ok),
    },
    { key: 'Enter', target: 'cell', run: onDetailColumn(rowKey => slice.toggle(rowKey).ok) },
  ];
}

export function detailRows<TRow = never>(
  options: IDetailRowsOptions<TRow> = {}
): ITableExtension<TRow, 'detailRows', IDetailRowsSlice> {
  return {
    id: 'detailRows',
    create(kernel): IExtensionInstance<TRow, IDetailRowsSlice> {
      const slice = new DetailRowsSlice(kernel, options);
      return {
        slice,
        columns: [detailColumn()],
        rowExtent: rowKey => slice.extentOf(rowKey),
        keys: detailKeys(slice),
        menu: ({ target, rowKey }) =>
          target !== 'cell' ||
          rowKey === undefined ||
          (!slice.isExpanded(rowKey) && slice.reasonAgainst(rowKey) !== undefined)
            ? []
            : [
                {
                  id: 'detailRows.toggle',
                  label: slice.isExpanded(rowKey) ? 'menu.detail.hide' : 'menu.detail.show',
                  section: 'rows',
                  run: () => void slice.toggle(rowKey),
                },
              ],
        state:
          options.persistExpanded === true
            ? {
                read: () => slice.readState(),
                write: value =>
                  Array.isArray(value) && slice.writeState(value as readonly string[]),
                reset: () => slice.collapseAll(),
              }
            : undefined,
        dispose: () => undefined,
      };
    },
  };
}
