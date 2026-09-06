import type { DraggableAttributes, DraggableSyntheticListeners } from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@frozik/components/components/cn';
import { GripVertical } from 'lucide-react';
import { memo } from 'react';
import type { CsgOperand, ShapeId } from '../../domain/model/shapes';
import { sitePlannerT } from '../translations';
import { operandIcon, describeOperand } from './structure-term-labels';
import { ICON_SIZE_PX, ACTION_BUTTON_CLASS, indentClass } from './structure-term-styles';

/** The drag-and-drop furniture of the structure tree: the grip, the drop seams and what travels under the pointer. */
/** Names the term list of the composition itself in the id of a drop zone. */
const ROOT_DROP_KEY = 'root';

/**
 * The place a drop stands for: an index in the terms of a group, or of the
 * composition itself when no group is named. It travels as the payload of a drop
 * zone, which is why it is read back rather than trusted.
 */
interface TermDropTarget {
  readonly groupId: ShapeId | undefined;
  readonly index: number;
}

/**
 * The grip a term is dragged by. A handle of its own rather than the whole row:
 * the row is what selects a term, and a press that both selects and picks up
 * would make one of the two impossible to do on purpose.
 */
export const TermDragHandle = memo(
  ({
    attributes,
    listeners,
    setActivatorNodeRef,
  }: {
    readonly attributes: DraggableAttributes;
    readonly listeners: DraggableSyntheticListeners;
    readonly setActivatorNodeRef: (element: HTMLElement | null) => void;
  }) => (
    <button
      ref={setActivatorNodeRef}
      type="button"
      aria-label={sitePlannerT.structure.dragHandle}
      className={cn(ACTION_BUTTON_CLASS, 'cursor-grab touch-none active:cursor-grabbing')}
      {...attributes}
      {...listeners}
    >
      <GripVertical size={ICON_SIZE_PX} aria-hidden />
    </button>
  )
);

/** The seam between two rows: where a term lands to take a place in the list. */
export const TermDropGap = memo(
  ({
    groupId,
    index,
    depth,
    isDisabled,
  }: {
    readonly groupId: ShapeId | undefined;
    readonly index: number;
    readonly depth: number;
    readonly isDisabled: boolean;
  }) => {
    const { setNodeRef, isOver } = useDroppable({
      id: `gap:${groupId ?? ROOT_DROP_KEY}:${index}`,
      data: { groupId, index },
      disabled: isDisabled,
    });

    return (
      <li
        ref={setNodeRef}
        aria-hidden
        className={cn('relative h-1.5 shrink-0', indentClass(depth))}
      >
        {isOver ? (
          <div className="pointer-events-none absolute inset-x-1 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-brand-500" />
        ) : undefined}
      </li>
    );
  }
);

/** What travels under the pointer while a term is being dragged. */
export const TermDragPreview = memo(({ operand }: { readonly operand: CsgOperand }) => {
  const OperandIcon = operandIcon(operand);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-brand-500/40 bg-surface-overlay px-2 py-1 text-[11px] text-text shadow-lg">
      <OperandIcon size={ICON_SIZE_PX} className="shrink-0" aria-hidden />
      <span className="truncate">{describeOperand(operand)}</span>
    </div>
  );
});

/**
 * Reads back what a drop zone was carrying. The payload leaves the tree through
 * dnd-kit, which types it as free-form data, so it is checked on the way back in
 * rather than taken on trust.
 */
export function readDropTarget(
  data: Record<string, unknown> | undefined
): TermDropTarget | undefined {
  const index = data?.index;
  const groupId = data?.groupId;

  if (typeof index !== 'number') {
    return undefined;
  }

  return { index, groupId: typeof groupId === 'string' ? (groupId as ShapeId) : undefined };
}
