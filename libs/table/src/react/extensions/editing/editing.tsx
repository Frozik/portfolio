import type { KeyboardEvent, MouseEvent } from 'react';

import type { ITableExtension } from '../../../core/kernel/extension';
import type { ICellAccessors, IEditingOptions } from '../../../extensions/editing/contracts';
import type { IEditingSlice } from '../../../extensions/editing/core';
import { editing as editingCore } from '../../../extensions/editing/core';
import type { ICellContext, IColumn } from '../../column';
import type { IViewContributions } from '../../slots';
import { withView } from '../withView';
import { editorFor } from './editorFor';
import { EditorOverlay } from './EditorOverlay';

const START_KEYS: ReadonlySet<string> = new Set(['Enter', 'F2']);
const CLEAR_KEYS: ReadonlySet<string> = new Set(['Backspace', 'Delete']);

function accessorsOf<TRow>(column: IColumn<TRow>): ICellAccessors<TRow> | undefined {
  if (column.set === undefined) {
    return undefined;
  }
  return {
    set: (row, value) => column.set?.(row, value) ?? row,
    validate:
      column.validate === undefined ? undefined : (draft, row) => column.validate?.(draft, row),
    equals:
      column.equals === undefined
        ? undefined
        : (left, right) => column.equals?.(left, right) ?? false,
  };
}

/** Whether this cell may be edited: the kernel rules plus what the cell-level spec says. */
function canEdit<TRow>(slice: IEditingSlice<TRow>, context: ICellContext<TRow>): boolean {
  const column = context.column as IColumn<TRow>;
  if (column.interactive === true || column.set === undefined || column.editable === false) {
    return false;
  }
  if (typeof column.editable === 'function' && !column.editable(context.row)) {
    return false;
  }
  return (
    slice.reasonAgainst(context.rowKey, column.id) === undefined && editorFor(context) !== undefined
  );
}

function begin<TRow>(
  slice: IEditingSlice<TRow>,
  context: ICellContext<TRow>,
  initialKey?: string
): boolean {
  if (!canEdit(slice, context)) {
    return false;
  }
  const column = context.column as IColumn<TRow>;
  context.table.focus.focusCell(context.rowKey, column.id);
  if (editorFor(context)?.kind === 'checkbox') {
    slice.begin({ rowKey: context.rowKey, columnId: column.id, accessors: accessorsOf(column) });
    slice.update(context.value !== true);
    slice.commit();
    return true;
  }
  return slice.begin({
    rowKey: context.rowKey,
    columnId: column.id,
    initialKey,
    accessors: accessorsOf(column),
  }).ok;
}

function editingView<TRow>(slice: IEditingSlice<TRow>): IViewContributions<TRow> {
  return {
    'cell.overlay': EditorOverlay,
    'cell.decorate': [
      {
        id: 'editing.state',
        decorate: context => ({
          data: {
            editable: canEdit(slice, context),
            editing: slice.isEditing(context.rowKey, context.column.id),
            edited: slice.isEdited(context.rowKey, context.column.id),
            updating: slice.updating.has(context.rowKey),
            failed: slice.failures.has(context.rowKey),
          },
        }),
      },
    ],
    'cell.props': [
      {
        id: 'editing.start',
        props: context => ({
          onDoubleClick: (event: MouseEvent<HTMLDivElement>) => {
            if (begin(slice, context)) {
              event.preventDefault();
            }
          },
          onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
            if (slice.current !== null || event.metaKey || event.ctrlKey || event.altKey) {
              return;
            }
            const printable = event.key.length === 1;
            const isSpace = event.key === ' ';
            const starts =
              START_KEYS.has(event.key) || CLEAR_KEYS.has(event.key) || (printable && !isSpace);
            const toggles = isSpace && editorFor(context)?.kind === 'checkbox';
            if (!starts && !toggles) {
              return;
            }
            const initialKey = START_KEYS.has(event.key) ? undefined : event.key;
            if (begin(slice, context, initialKey)) {
              event.preventDefault();
              event.stopPropagation();
            }
          },
        }),
      },
    ],
  };
}

/** Cell editing with the built-in editors: double-click, Enter, F2 or typing opens one; the model stays in the core slice. */
export function editing<TRow = never>(
  options: IEditingOptions<TRow> = {}
): ITableExtension<TRow, 'editing', IEditingSlice<TRow>> {
  return withView(editingCore<TRow>(options), editingView);
}
