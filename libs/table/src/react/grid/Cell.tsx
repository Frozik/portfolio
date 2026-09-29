import { isEqual, noop } from 'lodash-es';
import { computed, untracked } from 'mobx';
import { observer } from 'mobx-react-lite';
import type { MouseEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { cn } from '@frozik/components/components/cn';

import { columnText } from '../../core/columns/column';
import type { IColumnLayout } from '../../core/columns/columns-model';
import { defaultCellFor } from '../cells/defaultCell';
import type { ICellContext, ICellEdit, ICellProps, IColumn } from '../column';
import { resolve, resolveCell } from '../column';
import { useTableContext } from '../context';
import type { ICellLook } from './cellAttributes';
import { mergeDecorations, mergeProps, positionAttributes } from './cellAttributes';

/** Numbers expose their sign, so a theme can colour gains and losses. */
function signOf(value: unknown): 'positive' | 'negative' | 'zero' | undefined {
  if (typeof value === 'number') {
    return value > 0 ? 'positive' : value < 0 ? 'negative' : 'zero';
  }
  if (typeof value === 'bigint') {
    return value > 0n ? 'positive' : value < 0n ? 'negative' : 'zero';
  }
  return undefined;
}

interface ICellState {
  readonly isFocused: boolean;
  readonly isEditing: boolean;
  readonly editable: boolean;
  readonly look: ICellLook;
  readonly cellClass: string | undefined;
}

/** What a cell can do about editing without the editing extension: nothing. */
function inertEdit<TValue>(value: TValue): ICellEdit<TValue> {
  return {
    draft: value,
    validation: undefined,
    initialKey: undefined,
    update: noop,
    commit: noop,
    cancel: noop,
    change: () => false,
  };
}

/**
 * Everything observable a cell shows is derived in one computed per cell and
 * compared by value, so a change of focus, selection or an edit session
 * re-renders the cells whose look changed and re-evaluates the rest for
 * microseconds. Event handlers are read untracked: they look state up when
 * they fire, never at render time.
 */
export const Cell = observer(function Cell<TRow>({
  layout,
  columns,
  row,
  rowKey,
  rowIndex,
}: {
  readonly layout: IColumnLayout<TRow>;
  readonly columns: readonly IColumnLayout<TRow>[];
  readonly row: TRow;
  readonly rowKey: string;
  readonly rowIndex: number;
}) {
  const { table, slots, cellSpec, focusable } = useTableContext<TRow>();
  const declared = layout.definition as IColumn<TRow>;
  const column = useMemo(() => {
    if (cellSpec === undefined) {
      return declared;
    }
    const base: ICellContext<TRow> = {
      table,
      column: declared,
      layout,
      row,
      rowKey,
      rowIndex,
      value: declared.value(row),
      text: columnText(declared, row),
      isFocused: false,
      isEditing: false,
    };
    const spec = cellSpec(base);
    return spec === undefined ? declared : { ...declared, ...spec };
  }, [cellSpec, declared, table, layout, row, rowKey, rowIndex]);
  const value = column.value(row);
  const text = columnText(column, row);
  const contextOf = useCallback(
    (isFocused: boolean, isEditing: boolean): ICellContext<TRow> => ({
      table,
      column,
      layout,
      row,
      rowKey,
      rowIndex,
      value,
      text,
      isFocused,
      isEditing,
    }),
    [table, column, layout, row, rowKey, rowIndex, value, text]
  );
  const editSlot = slots.single('cell.edit');
  const stateBox = useMemo(
    () =>
      computed(
        (): ICellState => {
          const isFocused = table.focus.isFocused(rowKey, column.id);
          const isEditing = editSlot?.isEditing(rowKey, column.id) ?? false;
          const context = contextOf(isFocused, isEditing);
          return {
            isFocused,
            isEditing,
            editable: editSlot?.editable(context) ?? false,
            look: mergeDecorations([
              ...slots.list('cell.decorate').map(named => named.decorate(context)),
              resolve(column.decorate, context),
            ]),
            cellClass: resolve(column.cellClass, context),
          };
        },
        { equals: isEqual }
      ),
    [table, slots, editSlot, column, rowKey, contextOf]
  );
  const state = stateBox.get();
  const context = contextOf(state.isFocused, state.isEditing);
  const cellProps: ICellProps<TRow> = {
    ...context,
    mode: column.interactive === true ? undefined : state.isEditing ? 'edit' : 'view',
    editable: state.editable,
    edit: editSlot === undefined ? inertEdit(value) : editSlot.editOf(context),
  };
  const resolvedCell = resolveCell(column.cell, cellProps);
  const Content =
    resolvedCell !== undefined && 'Component' in resolvedCell
      ? resolvedCell.Component
      : (slots.single('cell') ?? defaultCellFor<TRow>(column.kind));
  const content =
    resolvedCell !== undefined && 'node' in resolvedCell ? (
      resolvedCell.node
    ) : (
      <Content {...cellProps} />
    );
  const validation = state.isEditing ? cellProps.edit.validation : undefined;
  const props = untracked(() => mergeProps(slots.list('cell.props'), context));
  const position = positionAttributes(layout, columns);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (
      state.isFocused &&
      !state.isEditing &&
      element !== null &&
      !element.contains(document.activeElement)
    ) {
      element.focus({ preventScroll: true });
    }
  }, [state.isFocused, state.isEditing]);

  const handleClick = useEventCallback((event: MouseEvent<HTMLDivElement>) => {
    props.onClick?.(event);
    if (focusable && column.interactive !== true) {
      table.focus.focusCell(rowKey, column.id);
    }
  });

  return (
    <div
      ref={elementRef}
      role="gridcell"
      aria-colindex={layout.index + 1}
      tabIndex={state.isFocused ? 0 : -1}
      {...props}
      {...position}
      {...state.look.data}
      {...state.look.aria}
      onClick={handleClick}
      className={cn('ft-cell', state.cellClass, state.look.className, props.className)}
      style={{ ...position.style, ...state.look.style, ...props.style }}
      data-kind={column.kind}
      data-sign={signOf(value)}
      data-focused={state.isFocused ? '' : undefined}
      data-editing={state.isEditing ? '' : undefined}
      data-editable={state.editable ? '' : undefined}
      data-invalid={validation?.level === 'error' ? '' : undefined}
      data-warning={validation?.level === 'warning' ? '' : undefined}
      title={validation?.message}
      data-wrap={column.wrap === true ? '' : undefined}
      data-interactive={column.interactive === true ? '' : undefined}
    >
      {content}
    </div>
  );
});
