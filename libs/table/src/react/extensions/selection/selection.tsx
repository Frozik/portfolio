import type { MouseEvent } from 'react';

import { columnTitle } from '../../../core/columns/column';
import type { ICellPosition } from '../../../core/focus/focus-model';
import type { IExtensionInstance, ITableExtension } from '../../../core/kernel/extension';
import type { ISelectionOptions, ISelectionSlice } from '../../../extensions/selection/contracts';
import { selection as selectionCore } from '../../../extensions/selection/core';
import type { IRangeEdges } from '../../../extensions/selection/ranges';
import type { ICellContext, IColumn } from '../../column';
import type { IViewContributions } from '../../slots';
import { SelectionCell, SelectionHeader } from './SelectionCheckbox';

const PRIMARY_BUTTON = 0;

function edgeTokens(edges: IRangeEdges | undefined): string | undefined {
  if (edges === undefined) {
    return undefined;
  }
  const tokens = (['top', 'right', 'bottom', 'left'] as const).filter(edge => edges[edge]);
  return tokens.length === 0 ? undefined : tokens.join(' ');
}

function isModifier(event: MouseEvent): boolean {
  return event.metaKey || event.ctrlKey;
}

/** Pointer gestures of a cell block: press starts one, Shift extends, Ctrl/⌘ adds, dragging grows the last. */
function cellGestures<TRow>(slice: ISelectionSlice<TRow>) {
  let dragging = false;
  const stopDragging = (): void => {
    dragging = false;
  };
  return (position: ICellPosition) => ({
    onMouseDown: (event: MouseEvent<HTMLDivElement>) => {
      if (event.button !== PRIMARY_BUTTON) {
        return;
      }
      event.preventDefault();
      if (event.shiftKey) {
        slice.extendRange(position);
      } else {
        slice.startRange(position, { add: isModifier(event) });
      }
      dragging = true;
      window.addEventListener('mouseup', stopDragging, { once: true });
    },
    onMouseEnter: () => {
      if (dragging) {
        slice.extendRange(position);
      }
    },
  });
}

/** Click selects, Shift+click extends, Ctrl/⌘+click toggles; a modified press must not start a text selection. */
function rowGestures<TRow>(slice: ISelectionSlice<TRow>) {
  return (rowKey: string) => ({
    onMouseDown: (event: MouseEvent<HTMLDivElement>) => {
      if (event.shiftKey || isModifier(event)) {
        event.preventDefault();
      }
    },
    onClick: (event: MouseEvent<HTMLDivElement>) => {
      if (event.shiftKey) {
        slice.range(rowKey, { add: isModifier(event) });
      } else if (isModifier(event)) {
        slice.toggle(rowKey);
      } else {
        slice.select(rowKey);
      }
    },
  });
}

function selectionView<TRow>(slice: ISelectionSlice<TRow>): IViewContributions<TRow> {
  const cells = cellGestures(slice);
  const rows = rowGestures(slice);
  return {
    'cell.decorate': [
      {
        id: 'selection.state',
        decorate: ({ rowKey, column }) => {
          const cell = slice.cellState(rowKey, column.id);
          const selected = slice.isSelected(rowKey);
          return {
            data: {
              selected,
              'in-range': cell.selected,
              'range-edge': edgeTokens(cell.edges),
            },
            aria: { selected: selected || cell.selected },
          };
        },
      },
    ],
    'cell.props': [
      {
        id: 'selection.pointer',
        props: ({ table, rowKey, column }: ICellContext<TRow>) => {
          if (table.columns.isService(column.id)) {
            return {};
          }
          const cell = cells({ rowKey, columnId: column.id });
          const row = rows(rowKey);
          return {
            onMouseDown: event =>
              slice.mode.cells ? cell.onMouseDown(event) : row.onMouseDown(event),
            onMouseEnter: () => slice.mode.cells && cell.onMouseEnter(),
            onClick: event => {
              if (
                !slice.mode.cells &&
                slice.mode.rows !== 'none' &&
                slice.selectOnClick === 'row'
              ) {
                row.onClick(event);
              }
            },
          };
        },
      },
    ],
  };
}

/** Row and cell selection with its checkbox column, pointer gestures and `data-selected` / `data-in-range` cell marks. */
export function selection<TRow = never>(
  options: ISelectionOptions<TRow> = {}
): ITableExtension<TRow, 'selection', ISelectionSlice<TRow>> {
  const core = selectionCore<TRow>(options);
  return {
    ...core,
    create(kernel): IExtensionInstance<TRow, ISelectionSlice<TRow>> {
      const instance = core.create(kernel);
      const columns = instance.columns?.map((column): IColumn<TRow> => ({
        ...column,
        title: columnTitle(column),
        cell: SelectionCell,
        header: SelectionHeader,
      }));
      return {
        ...instance,
        columns,
        view: selectionView(instance.slice) as Readonly<Record<string, unknown>>,
      };
    },
  };
}
