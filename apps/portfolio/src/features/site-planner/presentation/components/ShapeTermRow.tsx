import { useDraggable } from '@dnd-kit/core';
import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { useIsCoarsePointer } from '@frozik/components/hooks/useIsCoarsePointer';
import { isNil } from 'lodash-es';
import { ChevronDown, ChevronUp, Circle, Group, Square, Trash2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { ReactNode } from 'react';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { ShapeOwner } from '../../domain/model/selection';
import type { CsgOperation, Shape, ShapeId } from '../../domain/model/shapes';
import { sitePlannerT } from '../translations';
import { describeShape } from './structure-term-labels';
import {
  ICON_SIZE_PX,
  ACTION_BUTTON_CLASS,
  TERM_ROW_CLASS,
  TERM_LABEL_CLASS,
  HOVER_ACTIONS_CLASS,
  indentClass,
} from './structure-term-styles';
import { TermDragHandle } from './StructureTermDrag';

/** A shape's row in the structure tree, with the operation toggle and the action cluster every row carries. */
/** The rows of the structure tree — a shape, a group with its subtree — and the list that lays them out with drop seams between. */
const UNION_GLYPH = '∪';

const SUBTRACT_GLYPH = '−';

/**
 * How a term joins the fold. It stands next to the grip rather than in the
 * cluster of actions: the operation is what the row *is*, and reading it must
 * not depend on pointing at the row first.
 */
export const TermOperationToggle = observer(
  ({
    store,
    owner,
    operandId,
    operation,
  }: {
    readonly store: SitePlannerStore;
    readonly owner: ShapeOwner;
    readonly operandId: ShapeId;
    readonly operation: CsgOperation;
  }) => {
    const isUnion = operation === 'union';
    const handleToggleOperation = useFunction(() =>
      store.composition.toggleTermOperation(owner, operandId)
    );

    return (
      <button
        type="button"
        aria-label={isUnion ? sitePlannerT.structure.union : sitePlannerT.structure.subtract}
        onClick={handleToggleOperation}
        className={cn(ACTION_BUTTON_CLASS, 'font-mono text-xs', isUnion && 'text-brand-500')}
      >
        {isUnion ? UNION_GLYPH : SUBTRACT_GLYPH}
      </button>
    );
  }
);

/**
 * What is done *to* a term: where it stands in the list and the two ways of
 * taking it out of it. The kind of operand only decides what sits in
 * `extraAction`. A finger has no hover, so a coarse pointer keeps the cluster in
 * the row and lets the label truncate instead.
 */
export const TermActions = observer(
  ({
    store,
    owner,
    operandId,
    index,
    termCount,
    removeLabel,
    extraAction,
  }: {
    readonly store: SitePlannerStore;
    readonly owner: ShapeOwner;
    readonly operandId: ShapeId;
    readonly index: number;
    readonly termCount: number;
    readonly removeLabel: string;
    readonly extraAction: ReactNode;
  }) => {
    const isCoarsePointer = useIsCoarsePointer();

    const handleMoveUp = useFunction(() =>
      store.composition.reorderTerm(owner, operandId, index - 1)
    );
    const handleMoveDown = useFunction(() =>
      store.composition.reorderTerm(owner, operandId, index + 1)
    );
    const handleRemove = useFunction(() => store.composition.removeTerm(owner, operandId));

    return (
      <div
        className={cn(
          'flex items-center gap-0.5',
          isCoarsePointer ? 'shrink-0' : HOVER_ACTIONS_CLASS
        )}
      >
        <button
          type="button"
          aria-label={sitePlannerT.structure.moveUp}
          disabled={index === 0}
          onClick={handleMoveUp}
          className={ACTION_BUTTON_CLASS}
        >
          <ChevronUp size={ICON_SIZE_PX} aria-hidden />
        </button>
        <button
          type="button"
          aria-label={sitePlannerT.structure.moveDown}
          disabled={index === termCount - 1}
          onClick={handleMoveDown}
          className={ACTION_BUTTON_CLASS}
        >
          <ChevronDown size={ICON_SIZE_PX} aria-hidden />
        </button>
        {extraAction}
        <button
          type="button"
          aria-label={removeLabel}
          onClick={handleRemove}
          className={ACTION_BUTTON_CLASS}
        >
          <Trash2 size={ICON_SIZE_PX} aria-hidden />
        </button>
      </div>
    );
  }
);

export const ShapeTermRow = observer(
  ({
    store,
    owner,
    shape,
    operation,
    index,
    termCount,
    depth,
  }: {
    readonly store: SitePlannerStore;
    readonly owner: ShapeOwner;
    readonly shape: Shape;
    readonly operation: CsgOperation;
    readonly index: number;
    readonly termCount: number;
    readonly depth: number;
  }) => {
    const { selection } = store;
    const isSelected =
      !isNil(selection) && selection.kind === 'shape' && selection.shapeId === shape.id;
    const ShapeIcon = shape.kind === 'rectangle' ? Square : Circle;
    const label = describeShape(shape);

    const handleSelect = useFunction(() =>
      store.setSelection({ kind: 'shape', owner, shapeId: shape.id })
    );
    const handleWrapInGroup = useFunction(() => store.composition.wrapTermInGroup(owner, shape.id));

    const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
      id: shape.id,
    });

    return (
      <li
        ref={setNodeRef}
        className={cn(
          TERM_ROW_CLASS,
          indentClass(depth),
          isSelected ? 'bg-brand-500/20' : 'hover:bg-white/5',
          isDragging && 'opacity-40'
        )}
      >
        <TermDragHandle
          attributes={attributes}
          listeners={listeners}
          setActivatorNodeRef={setActivatorNodeRef}
        />

        <TermOperationToggle
          store={store}
          owner={owner}
          operandId={shape.id}
          operation={operation}
        />

        <button
          type="button"
          aria-pressed={isSelected}
          title={label}
          onClick={handleSelect}
          className={cn(TERM_LABEL_CLASS, isSelected ? 'text-text' : 'text-text-secondary')}
        >
          <ShapeIcon size={ICON_SIZE_PX} className="shrink-0" aria-hidden />
          <span className="truncate font-mono text-[11px]">{label}</span>
        </button>

        <TermActions
          store={store}
          owner={owner}
          operandId={shape.id}
          index={index}
          termCount={termCount}
          removeLabel={sitePlannerT.structure.remove}
          extraAction={
            <button
              type="button"
              aria-label={sitePlannerT.structure.wrapInGroup}
              onClick={handleWrapInGroup}
              className={ACTION_BUTTON_CLASS}
            >
              <Group size={ICON_SIZE_PX} aria-hidden />
            </button>
          }
        />
      </li>
    );
  }
);
