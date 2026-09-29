import type { KeyboardEvent, MouseEvent } from 'react';

import type { TFocusMove } from '../../../core/focus/focus-model';
import type { ITableExtension } from '../../../core/kernel/extension';
import type { IEditingOptions } from '../../../extensions/editing/contracts';
import { columnAccessors, columnAllowsEdit } from '../../../extensions/editing/contracts';
import type { IEditingSlice } from '../../../extensions/editing/contracts';
import { editing as editingCore } from '../../../extensions/editing/core';
import type { ICellContext, ICellEdit, IColumn } from '../../column';
import type { IViewContributions } from '../../slots';
import { withView } from '../withView';
import { OutsideClickCommit } from './OutsideClickCommit';

const START_KEYS: ReadonlySet<string> = new Set(['Enter', 'F2']);
const CLEAR_KEYS: ReadonlySet<string> = new Set(['Backspace', 'Delete']);

/** The column as the cell sees it, after a `cellSpec` narrowed it. */
function columnOf<TRow>(context: ICellContext<TRow>): IColumn<TRow> {
  return context.column as IColumn<TRow>;
}

/** The column rule, the table rules and the row state: what `editable` tells the component. */
function editableOf<TRow>(slice: IEditingSlice<TRow>, context: ICellContext<TRow>): boolean {
  const column = columnOf(context);
  return (
    columnAllowsEdit(column, context.row, context.rowKey) &&
    slice.reasonAgainst(context.rowKey, column.id) === undefined
  );
}

/** A boolean flips without a session; an interactive column edits itself; the rest go through the table's session. */
function sessionKind<TRow>(context: ICellContext<TRow>): 'session' | 'toggle' | 'none' {
  const column = columnOf(context);
  return column.interactive === true ? 'none' : column.kind === 'boolean' ? 'toggle' : 'session';
}

function finish<TRow>(
  slice: IEditingSlice<TRow>,
  context: ICellContext<TRow>,
  move: TFocusMove | undefined
): void {
  if (slice.commit() && move !== undefined) {
    context.table.focus.move(move);
  }
}

function editOf<TRow>(slice: IEditingSlice<TRow>, context: ICellContext<TRow>): ICellEdit<unknown> {
  const column = columnOf(context);
  const session = slice.isEditing(context.rowKey, column.id) ? slice.current : null;
  return {
    draft: session === null ? context.value : session.draft,
    validation: session?.validation,
    initialKey: session?.initialKey,
    update: slice.update,
    commit: () => finish(slice, context, undefined),
    cancel: slice.cancel,
    change: value =>
      columnAllowsEdit(column, context.row, context.rowKey) &&
      slice.change({
        rowKey: context.rowKey,
        columnId: column.id,
        value,
        accessors: columnAccessors(column),
      }).ok,
  };
}

function begin<TRow>(
  slice: IEditingSlice<TRow>,
  context: ICellContext<TRow>,
  initialKey?: string
): boolean {
  if (sessionKind(context) !== 'session' || !editableOf(slice, context)) {
    return false;
  }
  const column = columnOf(context);
  context.table.focus.focusCell(context.rowKey, column.id);
  return slice.begin({
    rowKey: context.rowKey,
    columnId: column.id,
    initialKey,
    accessors: columnAccessors(column),
  }).ok;
}

function toggle<TRow>(slice: IEditingSlice<TRow>, context: ICellContext<TRow>): boolean {
  if (sessionKind(context) !== 'toggle' || !editableOf(slice, context)) {
    return false;
  }
  context.table.focus.focusCell(context.rowKey, context.column.id);
  return editOf(slice, context).change(context.value !== true);
}

function handleSessionKey<TRow>(
  slice: IEditingSlice<TRow>,
  context: ICellContext<TRow>,
  event: KeyboardEvent<HTMLDivElement>
): boolean {
  switch (event.key) {
    case 'Enter':
      finish(slice, context, slice.enterMovesDown ? 'down' : undefined);
      return true;
    case 'Tab':
      finish(slice, context, event.shiftKey ? 'left' : 'right');
      return true;
    case 'Escape':
      slice.cancel();
      return true;
    default:
      return false;
  }
}

function handleStartKey<TRow>(
  slice: IEditingSlice<TRow>,
  context: ICellContext<TRow>,
  event: KeyboardEvent<HTMLDivElement>
): boolean {
  if (event.metaKey || event.ctrlKey || event.altKey) {
    return false;
  }
  const isSpace = event.key === ' ';
  if (sessionKind(context) === 'toggle') {
    return (isSpace || event.key === 'Enter') && toggle(slice, context);
  }
  const printable = event.key.length === 1 && !isSpace;
  if (!START_KEYS.has(event.key) && !CLEAR_KEYS.has(event.key) && !printable) {
    return false;
  }
  return begin(slice, context, START_KEYS.has(event.key) ? undefined : event.key);
}

function editingView<TRow>(slice: IEditingSlice<TRow>): IViewContributions<TRow> {
  return {
    'cell.edit': {
      isEditing: (rowKey, columnId) => slice.isEditing(rowKey, columnId),
      editable: context => editableOf(slice, context),
      editOf: context => editOf(slice, context),
    },
    'cell.decorate': [
      {
        id: 'editing.state',
        decorate: context => ({
          data: {
            edited: slice.isEdited(context.rowKey, context.column.id),
            updating: slice.updating.has(context.rowKey),
            failed: slice.failures.has(context.rowKey),
          },
        }),
      },
    ],
    'cell.props': [
      {
        id: 'editing.keys',
        props: context => ({
          onMouseDown: (event: MouseEvent<HTMLDivElement>) => {
            if (event.detail > 1 && editableOf(slice, context)) {
              event.preventDefault();
            }
          },
          onDoubleClick: (event: MouseEvent<HTMLDivElement>) => {
            if (toggle(slice, context) || begin(slice, context)) {
              event.preventDefault();
            }
          },
          onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
            const handled = slice.isEditing(context.rowKey, context.column.id)
              ? handleSessionKey(slice, context, event)
              : slice.current === null && handleStartKey(slice, context, event);
            if (handled) {
              event.preventDefault();
              event.stopPropagation();
            }
          },
        }),
      },
    ],
    floating: [{ id: 'editing.outsideClick', render: OutsideClickCommit }],
  };
}

/**
 * Cell editing through one component per cell: a double click, Enter, F2 or
 * typing puts the cell into edit mode (`mode: 'edit'` on its props), Enter,
 * Tab, Escape or a click outside end it. The second press of a double click
 * would select the word under it, and that selection would run into the
 * popup opening below, so it is suppressed on editable cells. A boolean flips without a session; a
 * cell of an `interactive` column decides its mode itself and writes through
 * `edit.change`. The model stays in the core slice.
 */
export function editing<TRow = never>(
  options: IEditingOptions<TRow> = {}
): ITableExtension<TRow, 'editing', IEditingSlice<TRow>> {
  return withView(editingCore<TRow>(options), editingView);
}
