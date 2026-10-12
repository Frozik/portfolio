import type { Announcements, DragEndEvent, UniqueIdentifier } from '@dnd-kit/core';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { isNil } from 'lodash-es';
import type { KeyboardEvent, ReactNode, RefObject } from 'react';
import { createRef, useEffect, useMemo, useRef } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { cn } from '../cn';
import type { IRichEditorHandle } from './defs';
import { moveItem, removeItem, replaceItem } from './list-edit';
import { ListEditorRow } from './ListEditorRow';
import { getCalendarAriaLabels } from './translations/translations';
import controlTokens from '../control-tokens.module.css';
import styles from './styles.module.css';

export interface IListItemControls<T> {
  readonly onChange: (item: T) => void;
  readonly ref: RefObject<IRichEditorHandle | null>;
}

interface IRow {
  readonly key: number;
  readonly handle: RefObject<IRichEditorHandle | null>;
}

const DRAG_THRESHOLD_PX = 4;

function rowIdOf(key: number): string {
  return `row-${key}`;
}

type TListEdit = <Item>(list: readonly Item[]) => readonly Item[];

/**
 * Items carry no identity of their own (two equal backup codes are fine), so
 * the list keeps a row per item beside them and moves it with every edit: a
 * moved item keeps its control, and the control keeps its focus.
 */
function useRows(length: number) {
  const rows = useRef<readonly IRow[]>([]);
  const nextKey = useRef(0);
  const newRow = (): IRow => ({ key: nextKey.current++, handle: createRef() });
  if (rows.current.length !== length) {
    rows.current = Array.from({ length }, (_, index) => rows.current[index] ?? newRow());
  }
  return { rows, newRow };
}

/**
 * A list of one control per item (the sites of an
 * account, backup codes): add, remove, reorder by the handle (drag, or Space
 * and the arrows) or with Alt+↑/↓.
 * Enter in the last item, when it is not empty, starts a new one. The items
 * render themselves; the list owns only their order.
 */
export function ListEditor<T>({
  className,
  items,
  onItemsChange,
  renderItem,
  createItem,
  isEmpty,
  disabled = false,
  locale = 'en',
  numbering,
}: {
  readonly className?: string;
  readonly items: readonly T[];
  readonly onItemsChange: (items: readonly T[]) => void;
  readonly renderItem: (item: T, index: number, controls: IListItemControls<T>) => ReactNode;
  readonly createItem: () => T;
  readonly isEmpty: (item: T) => boolean;
  readonly disabled?: boolean;
  readonly locale?: string;
  /** Numbers the items once there are two or more, the first marked and named `first` (the password in use of a rotation). */
  readonly numbering?: { readonly first: string };
}) {
  const labels = useMemo(() => getCalendarAriaLabels(locale), [locale]);
  const { rows, newRow } = useRows(items.length);
  const focusIndexRef = useRef<number | null>(null);

  useEffect(() => {
    const index = focusIndexRef.current;
    focusIndexRef.current = null;
    if (!isNil(index)) {
      rows.current[index]?.handle.current?.focus();
    }
  });

  const apply = useEventCallback((edit: TListEdit, focusIndex: number | null) => {
    rows.current = edit(rows.current);
    focusIndexRef.current = focusIndex;
    onItemsChange(edit(items));
  });
  const add = useEventCallback(() => {
    rows.current = [...rows.current, newRow()];
    focusIndexRef.current = items.length;
    onItemsChange([...items, createItem()]);
  });
  const move = (from: number, to: number) => {
    if (to >= 0 && to < items.length) {
      apply(list => moveItem(list, from, to), to);
    }
  };

  const handleKeyDownCapture = useEventCallback(
    (event: KeyboardEvent<HTMLDivElement>, index: number) => {
      const isLast = index === items.length - 1;
      const item = items[index];
      if (event.key === 'Enter' && !event.altKey && isLast && !isNil(item) && !isEmpty(item)) {
        event.preventDefault();
        event.stopPropagation();
        add();
      } else if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        event.preventDefault();
        event.stopPropagation();
        move(index, event.key === 'ArrowUp' ? index - 1 : index + 1);
      }
    }
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_THRESHOLD_PX } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const ids = rows.current.slice(0, items.length).map(row => rowIdOf(row.key));
  const positionOf = (id: UniqueIdentifier) => ids.indexOf(String(id)) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => labels.itemPickedUp(positionOf(active.id)),
    onDragOver: ({ over }) => (isNil(over) ? undefined : labels.itemMovedTo(positionOf(over.id))),
    onDragEnd: ({ active, over }) =>
      labels.itemDropped(positionOf(isNil(over) ? active.id : over.id)),
    onDragCancel: () => labels.itemMoveCancelled,
  };
  const handleDragEnd = useEventCallback(({ active, over }: DragEndEvent) => {
    if (!isNil(over)) {
      move(positionOf(active.id) - 1, positionOf(over.id) - 1);
    }
  });

  return (
    <div className={cn(controlTokens.tokens, styles.list, className)}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        accessibility={{
          announcements,
          screenReaderInstructions: { draggable: labels.reorderInstructions },
        }}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {items.map((item, index) => {
            const row = rows.current[index] ?? newRow();
            return (
              <ListEditorRow
                key={row.key}
                id={rowIdOf(row.key)}
                number={
                  isNil(numbering) || items.length < 2
                    ? null
                    : {
                        value: index + 1,
                        marked: index === 0,
                        label: index === 0 ? numbering.first : undefined,
                      }
                }
                disabled={disabled}
                movable={items.length > 1}
                moveLabel={labels.moveItem}
                removeLabel={labels.removeItem}
                onRemove={() =>
                  apply(list => removeItem(list, index), Math.min(index, items.length - 2))
                }
                onKeyDownCapture={event => handleKeyDownCapture(event, index)}
              >
                {renderItem(item, index, {
                  onChange: next => onItemsChange(replaceItem(items, index, next)),
                  ref: row.handle,
                })}
              </ListEditorRow>
            );
          })}
        </SortableContext>
      </DndContext>
      <button type="button" className={styles.listButton} disabled={disabled} onClick={add}>
        + {labels.addItem}
      </button>
    </div>
  );
}
