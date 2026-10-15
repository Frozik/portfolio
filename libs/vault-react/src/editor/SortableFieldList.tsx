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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { ICardField } from '@frozik/vault/model/card';
import type { TFieldId } from '@frozik/vault/model/ids';
import { isNil } from 'lodash-es';
import { GripVertical } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useEventCallback } from 'usehooks-ts';

import { editorT } from '../texts/editor';

const ICON_SIZE = 14;
const DRAG_THRESHOLD_PX = 4;

function SortableField({
  field,
  onStep,
  children,
}: {
  readonly field: ICardField;
  /** Alt+↑/↓ moves the field one place at once, as in `ListEditor`. */
  readonly onStep: (step: -1 | 1) => void;
  readonly children: (handle: ReactNode) => ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });
  const handle = (
    <button
      ref={setActivatorNodeRef}
      type="button"
      className="inline-flex size-7 cursor-grab touch-none items-center justify-center rounded-md text-landing-fg-faint hover:text-landing-fg active:cursor-grabbing"
      {...attributes}
      {...listeners}
      onKeyDown={event => {
        if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
          event.preventDefault();
          onStep(event.key === 'ArrowUp' ? -1 : 1);
        } else {
          listeners?.onKeyDown?.(event);
        }
      }}
      aria-label={editorT.moveField(field.label)}
    >
      <GripVertical size={ICON_SIZE} aria-hidden="true" />
    </button>
  );
  return (
    <div
      ref={setNodeRef}
      className={isDragging ? 'relative z-10 bg-landing-bg opacity-90' : undefined}
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      {children(handle)}
    </div>
  );
}

/**
 * A tab's fields in the editor, reordered by their handle:
 * dragged with a pointer, or taken with Space, moved with the arrows and put
 * down with Space again; Alt+↑/↓ moves one place at once.
 */
export function SortableFieldList({
  fields,
  onMove,
  children,
}: {
  readonly fields: readonly ICardField[];
  readonly onMove: (fieldId: TFieldId, index: number) => void;
  readonly children: (field: ICardField, handle: ReactNode) => ReactNode;
}) {
  const t = editorT.reorder;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DRAG_THRESHOLD_PX } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const announcements = useMemo((): Announcements => {
    const labelOf = (id: UniqueIdentifier) =>
      fields.find(field => field.id === id)?.label ?? String(id);
    const positionOf = (id: UniqueIdentifier) => fields.findIndex(field => field.id === id) + 1;
    return {
      onDragStart: ({ active }) => t.pickedUp(labelOf(active.id), positionOf(active.id)),
      onDragOver: ({ active, over }) =>
        isNil(over) ? undefined : t.movedTo(labelOf(active.id), positionOf(over.id)),
      onDragEnd: ({ active, over }) =>
        t.dropped(labelOf(active.id), isNil(over) ? positionOf(active.id) : positionOf(over.id)),
      onDragCancel: ({ active }) => t.cancelled(labelOf(active.id)),
    };
  }, [fields, t]);

  const handleDragEnd = useEventCallback(({ active, over }: DragEndEvent) => {
    if (isNil(over) || active.id === over.id) {
      return;
    }
    const target = fields.find(field => field.id === active.id);
    const index = fields.findIndex(field => field.id === over.id);
    if (!isNil(target) && index >= 0) {
      onMove(target.id, index);
    }
  });

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      accessibility={{ announcements, screenReaderInstructions: { draggable: t.instructions } }}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={fields.map(field => field.id)} strategy={verticalListSortingStrategy}>
        <div className="flex flex-col">
          {fields.map((field, index) => (
            <SortableField
              key={field.id}
              field={field}
              onStep={step => {
                const to = index + step;
                if (to >= 0 && to < fields.length) {
                  onMove(field.id, to);
                }
              }}
            >
              {handle => children(field, handle)}
            </SortableField>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
