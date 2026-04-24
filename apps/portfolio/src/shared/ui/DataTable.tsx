import type {
  Cell,
  ColumnDef,
  Header,
  Row,
  RowData,
  SortingState,
  VisibilityState,
} from '@tanstack/react-table';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import type { Virtualizer } from '@tanstack/react-virtual';
import { useVirtualizer } from '@tanstack/react-virtual';
import { isNil } from 'lodash-es';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { memo, useCallback, useRef, useState } from 'react';
import { cn } from '../lib/cn';

const SORT_ICON_SIZE = 14;
const DEFAULT_ROW_HEIGHT = 40;

// Stable references — TanStack best practice: create model getters ONCE outside component
const coreRowModel = getCoreRowModel();
const sortedRowModel = getSortedRowModel();

type DataTableProps<TData> = {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  className?: string;
  virtual?: boolean;
  scrollHeight?: number;
  initialSorting?: SortingState;
  columnVisibility?: VisibilityState;
};

export function DataTable<TData>({
  columns,
  data,
  className,
  virtual = false,
  scrollHeight,
  initialSorting,
  columnVisibility,
}: DataTableProps<TData>) {
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

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    getCoreRowModel: coreRowModel,
    getSortedRowModel: sortedRowModel,
  });

  const { rows } = table.getRowModel();

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
                <HeaderCell key={header.id} header={header as Header<RowData, unknown>} />
              ))}
            </tr>
          ))}
        </thead>
        {virtual ? (
          <VirtualBody
            rows={rows as Row<RowData>[]}
            virtualizer={virtualizer}
            columnCount={columns.length}
          />
        ) : (
          <tbody>
            {rows.map(row => (
              <DataRow key={row.id} row={row as Row<RowData>} />
            ))}
          </tbody>
        )}
      </table>
    </div>
  );
}

// Memoized header cell
const HeaderCell = memo(({ header }: { header: Header<RowData, unknown> }) => {
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
});

const DataRow = memo(({ row }: { row: Row<RowData> }) => (
  <tr className="border-b border-border hover:bg-surface-elevated">
    {row.getVisibleCells().map((cell: Cell<RowData, unknown>) => (
      <DataCell key={cell.id} cell={cell} />
    ))}
  </tr>
));

const DataCell = memo(({ cell }: { cell: Cell<RowData, unknown> }) => {
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
});

// Virtual body — only renders visible rows. No memo — virtualizer state is mutable.
function VirtualBody({
  rows,
  virtualizer,
  columnCount,
}: {
  rows: Row<RowData>[];
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
        return <DataRow key={row.id} row={row} />;
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

export type { DataTableProps };
