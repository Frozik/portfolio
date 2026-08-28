import { cn } from '@frozik/components/components/cn';
import type {
  Cell,
  ColumnDef,
  ColumnVisibilityState,
  Header,
  Row,
  RowData,
  SortingState,
} from '@tanstack/react-table';
import {
  columnSizingFeature,
  columnVisibilityFeature,
  createSortedRowModel,
  flexRender,
  metaHelper,
  rowSortingFeature,
  sortFns,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import type { Virtualizer } from '@tanstack/react-virtual';
import { useVirtualizer } from '@tanstack/react-virtual';
import { isNil } from 'lodash-es';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { memo, useCallback, useRef, useState } from 'react';

const SORT_ICON_SIZE = 14;
const DEFAULT_ROW_HEIGHT = 40;

// Stable reference — TanStack best practice: declare the feature set ONCE outside component
const dataTableFeatures = tableFeatures({
  rowSortingFeature,
  columnVisibilityFeature,
  columnSizingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns,
  columnMeta: metaHelper<{ readonly fixed?: 'left' | 'right' }>(),
});

export type TDataTableFeatures = typeof dataTableFeatures;

export function DataTable<TData extends RowData>({
  columns,
  data,
  className,
  virtual = false,
  scrollHeight,
  initialSorting,
  columnVisibility,
}: {
  columns: ColumnDef<TDataTableFeatures, TData, unknown>[];
  data: TData[];
  className?: string;
  virtual?: boolean;
  scrollHeight?: number;
  initialSorting?: SortingState;
  columnVisibility?: ColumnVisibilityState;
}) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting ?? []);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  // Force re-render when scroll container mounts so virtualizer can measure it
  const [, setScrollMounted] = useState(false);
  const scrollCallbackRef = useCallback((node: HTMLDivElement | null) => {
    scrollContainerRef.current = node;
    if (node) {
      setScrollMounted(true);
    }
  }, []);

  const table = useTable({
    features: dataTableFeatures,
    data,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
  });

  const { rows } = table.getRowModel();

  // estimateSize is only the FIRST guess — real row heights are measured via
  // measureElement refs on every rendered <tr>. Without measurement the
  // cumulative error (real height − estimate) per row shifts the virtualizer's
  // coordinate space away from reality, and on long lists rows visually
  // disappear / reappear while scrolling.
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => DEFAULT_ROW_HEIGHT,
    overscan: 10,
    enabled: virtual,
  });

  // Pre-compute header groups to avoid re-calling on each render
  const headerGroups = table.getHeaderGroups();

  return (
    <div
      ref={scrollCallbackRef}
      className={cn(
        'overflow-auto border border-border rounded-lg',
        isNil(scrollHeight) && 'h-full',
        className
      )}
      style={!isNil(scrollHeight) ? { height: scrollHeight } : undefined}
    >
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10 bg-surface-elevated">
          {headerGroups.map(headerGroup => (
            <tr key={headerGroup.id} className="border-b border-border">
              {headerGroup.headers.map(header => (
                <HeaderCell key={header.id} header={header} />
              ))}
            </tr>
          ))}
        </thead>
        {virtual ? (
          <VirtualBody rows={rows} virtualizer={virtualizer} columnCount={columns.length} />
        ) : (
          <tbody>
            {rows.map(row => (
              <DataRow key={row.id} row={row} />
            ))}
          </tbody>
        )}
      </table>
    </div>
  );
}

// Memoized header cell
function HeaderCellInner<TData extends RowData>({
  header,
}: {
  header: Header<TDataTableFeatures, TData, unknown>;
}) {
  const meta = header.column.columnDef.meta;
  const isFixed = !isNil(meta?.fixed);

  return (
    <th
      className={cn(
        'px-3 py-2 text-left text-xs font-medium text-text-secondary',
        header.column.getCanSort() && 'cursor-pointer select-none',
        isFixed && 'sticky z-20 bg-surface-elevated',
        meta?.fixed === 'left' && 'left-0',
        meta?.fixed === 'right' && 'right-0'
      )}
      style={{ width: header.getSize() }}
      onClick={header.column.getToggleSortingHandler()}
    >
      <span className="flex items-center gap-1">
        {header.isPlaceholder
          ? null
          : flexRender(header.column.columnDef.header, header.getContext())}
        {header.column.getCanSort() && <SortIndicator direction={header.column.getIsSorted()} />}
      </span>
    </th>
  );
}

const HeaderCell = memo(HeaderCellInner) as typeof HeaderCellInner;

function DataRowInner<TData extends RowData>({
  row,
  index,
  measureRef,
}: {
  row: Row<TDataTableFeatures, TData>;
  /** Virtual item index — read by the virtualizer's measureElement via data-index */
  index?: number;
  measureRef?: (element: HTMLTableRowElement | null) => void;
}) {
  return (
    <tr
      ref={measureRef}
      data-index={index}
      className="border-b border-border hover:bg-surface-elevated"
    >
      {row.getVisibleCells().map((cell: Cell<TDataTableFeatures, TData, unknown>) => (
        <DataCell key={cell.id} cell={cell} />
      ))}
    </tr>
  );
}

const DataRow = memo(DataRowInner) as typeof DataRowInner;

function DataCellInner<TData extends RowData>({
  cell,
}: {
  cell: Cell<TDataTableFeatures, TData, unknown>;
}) {
  const meta = cell.column.columnDef.meta;
  const isFixed = !isNil(meta?.fixed);

  return (
    <td
      className={cn(
        'px-3 py-2 text-sm text-text',
        isFixed && 'sticky z-10 bg-surface',
        meta?.fixed === 'left' && 'left-0',
        meta?.fixed === 'right' && 'right-0'
      )}
    >
      {flexRender(cell.column.columnDef.cell, cell.getContext())}
    </td>
  );
}

const DataCell = memo(DataCellInner) as typeof DataCellInner;

// Virtual body — only renders visible rows. No memo — virtualizer state is mutable.
function VirtualBody<TData extends RowData>({
  rows,
  virtualizer,
  columnCount,
}: {
  rows: Row<TDataTableFeatures, TData>[];
  virtualizer: Virtualizer<HTMLDivElement, Element>;
  columnCount: number;
}) {
  const virtualRows = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <tbody>
      {virtualRows.length > 0 && (
        <tr>
          <td style={{ height: virtualRows[0].start, padding: 0 }} colSpan={columnCount} />
        </tr>
      )}
      {virtualRows.map(virtualRow => {
        const row = rows[virtualRow.index];
        return (
          <DataRow
            key={row.id}
            row={row}
            index={virtualRow.index}
            measureRef={virtualizer.measureElement}
          />
        );
      })}
      {virtualRows.length > 0 && (
        <tr>
          <td
            style={{
              height: totalSize - virtualRows[virtualRows.length - 1].end,
              padding: 0,
            }}
            colSpan={columnCount}
          />
        </tr>
      )}
    </tbody>
  );
}

const SortIndicator = memo(({ direction }: { direction: false | 'asc' | 'desc' }) => {
  if (direction === 'asc') {
    return <ArrowUp size={SORT_ICON_SIZE} />;
  }
  if (direction === 'desc') {
    return <ArrowDown size={SORT_ICON_SIZE} />;
  }
  return <ArrowUpDown size={SORT_ICON_SIZE} className="opacity-30" />;
});
