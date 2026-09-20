import type { ReactNode } from 'react';
import { memo, useCallback, useMemo, useRef, useState } from 'react';

import { cn } from '../cn';

import type { SortState } from './table-sorting';
import { nextSortState, sortRows } from './table-sorting';
import { useVirtualRows } from './useVirtualRows';

const DEFAULT_ROW_HEIGHT_PX = 24;

export type VirtualTableColumn<TRow> = {
  readonly id: string;
  readonly header: ReactNode;
  /** The sortable value, and the cell contents when `cell` is absent. */
  readonly value: (row: TRow) => unknown;
  readonly cell?: (row: TRow) => ReactNode;
  readonly widthPx?: number;
  readonly sortable?: boolean;
  readonly align?: 'left' | 'right';
};

function SortMark({ direction }: { readonly direction: 'asc' | 'desc' | null }) {
  return (
    <span aria-hidden className="text-[10px] leading-none text-text-muted">
      {direction === 'asc' ? '▲' : direction === 'desc' ? '▼' : '↕'}
    </span>
  );
}

function RowInner<TRow>({
  row,
  columns,
  measure,
}: {
  readonly row: TRow;
  readonly columns: readonly VirtualTableColumn<TRow>[];
  readonly measure: (element: HTMLElement | null) => void;
}) {
  return (
    <tr ref={measure} className="border-b border-border hover:bg-surface-elevated">
      {columns.map(column => (
        <td
          key={column.id}
          className={cn(
            'px-2 py-1 text-sm text-text',
            column.align === 'right' && 'text-right tabular-nums'
          )}
        >
          {column.cell ? column.cell(row) : String(column.value(row) ?? '')}
        </td>
      ))}
    </tr>
  );
}

const Row = memo(RowInner) as typeof RowInner;

/**
 * A table that renders only the rows in view.
 *
 * Row heights are measured rather than assumed: with a single estimate the
 * error accumulates down the list, the scroll offsets drift from the rendered
 * content, and rows visibly appear and disappear while scrolling.
 */
export function VirtualTable<TRow>({
  rows,
  columns,
  rowKey,
  initialSort = null,
  hiddenColumnIds,
  estimatedRowHeightPx = DEFAULT_ROW_HEIGHT_PX,
  className,
  maxHeightPx,
  emptyMessage,
}: {
  readonly rows: readonly TRow[];
  readonly columns: readonly VirtualTableColumn<TRow>[];
  readonly rowKey: (row: TRow, index: number) => string;
  readonly initialSort?: SortState | null;
  readonly hiddenColumnIds?: Readonly<Record<string, boolean>>;
  readonly estimatedRowHeightPx?: number;
  readonly className?: string;
  /** Caps the scroll area; a runtime value, hence the inline style. */
  readonly maxHeightPx?: number;
  readonly emptyMessage?: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [sort, setSort] = useState<SortState | null>(initialSort);

  const visibleColumns = useMemo(
    () => columns.filter(column => hiddenColumnIds?.[column.id] !== true),
    [columns, hiddenColumnIds]
  );

  const columnsById = useMemo(() => new Map(columns.map(column => [column.id, column])), [columns]);

  const valueOf = useCallback(
    (row: TRow, columnId: string) => columnsById.get(columnId)?.value(row),
    [columnsById]
  );

  const sorted = useMemo(() => sortRows(rows, sort, valueOf), [rows, sort, valueOf]);

  const keyAt = useCallback((index: number) => rowKey(sorted[index], index), [sorted, rowKey]);

  const { startIndex, endIndex, offsetBefore, offsetAfter, measureRow } = useVirtualRows({
    count: sorted.length,
    estimatedRowHeight: estimatedRowHeightPx,
    scrollElementRef: scrollRef,
    keyAt,
  });

  const toggleSort = useCallback((columnId: string) => {
    setSort(current => nextSortState(current, columnId));
  }, []);

  if (sorted.length === 0 && emptyMessage !== undefined) {
    return <div className="px-2 py-3 text-center text-text-muted">{emptyMessage}</div>;
  }

  return (
    <div
      ref={scrollRef}
      className={cn('overflow-auto', className)}
      style={
        maxHeightPx === undefined || !Number.isFinite(maxHeightPx)
          ? undefined
          : { maxHeight: maxHeightPx }
      }
    >
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10 bg-surface-elevated">
          <tr>
            {visibleColumns.map(column => (
              <th
                key={column.id}
                scope="col"
                style={column.widthPx === undefined ? undefined : { width: column.widthPx }}
                className={cn(
                  'px-2 py-1 text-left text-xs font-medium text-text-secondary',
                  column.align === 'right' && 'text-right',
                  column.sortable === true && 'cursor-pointer select-none'
                )}
                aria-sort={
                  sort?.columnId === column.id
                    ? sort.direction === 'asc'
                      ? 'ascending'
                      : 'descending'
                    : undefined
                }
                onClick={column.sortable === true ? () => toggleSort(column.id) : undefined}
              >
                <span
                  className={cn(
                    'flex items-center gap-1',
                    column.align === 'right' && 'justify-end'
                  )}
                >
                  {column.header}
                  {column.sortable === true && (
                    <SortMark direction={sort?.columnId === column.id ? sort.direction : null} />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {offsetBefore > 0 && (
            <tr aria-hidden>
              <td colSpan={visibleColumns.length} style={{ height: offsetBefore, padding: 0 }} />
            </tr>
          )}
          {sorted.slice(startIndex, endIndex + 1).map((row, offset) => {
            const key = rowKey(row, startIndex + offset);
            return <Row key={key} row={row} columns={visibleColumns} measure={measureRow(key)} />;
          })}
          {offsetAfter > 0 && (
            <tr aria-hidden>
              <td colSpan={visibleColumns.length} style={{ height: offsetAfter, padding: 0 }} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
