import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import { Plus, Trash2 } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { memo, useMemo, useState } from 'react';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { ShapeOwner } from '../../domain/model/selection';
import type { CsgTerm, ShapeId } from '../../domain/model/shapes';
import { collectGroupSubtreeIds, findTerm, isShapeGroup } from '../../domain/model/shapes';
import { sitePlannerT } from '../translations';
import { PanelHint } from './PanelHint';
import { ICON_SIZE_PX, CHIP_ICON_SIZE_PX, ACTION_BUTTON_CLASS } from './structure-term-styles';
import { TermDragPreview, readDropTarget } from './StructureTermDrag';
import { TermList } from './StructureTermRows';

/** Shared by a section whose composition does not exist yet. */
const NO_TERMS: readonly CsgTerm[] = [];

/**
 * How far a grip travels before the row it holds starts moving. Enough that a
 * finger dragging the panel scrolls it instead of picking a term up, short
 * enough that a deliberate drag starts where the user expects it to.
 */
const DRAG_ACTIVATION_DISTANCE_PX = 4;

/** Shared by every section that has no group in flight. */
const NO_BLOCKED_GROUP_IDS: ReadonlySet<ShapeId> = new Set();

/**
 * Marks the list a newly drawn shape lands in. A chip rather than the sentence
 * it stands for: spelled out, it took more room than the section title it shares
 * its row with and pushed the title out from under itself. The sentence lives on
 * as the tooltip of the row.
 */
const ActiveGroupChip = memo(() => (
  <span
    className={cn(
      'flex shrink-0 items-center gap-0.5 rounded-full bg-brand-500/15 px-1.5 py-0.5',
      'font-mono text-[10px] uppercase tracking-[0.08em] text-brand-500'
    )}
  >
    <Plus size={CHIP_ICON_SIZE_PX} aria-hidden />
    <span aria-hidden>{sitePlannerT.structure.activeGroupShort}</span>
    <span className="sr-only">{sitePlannerT.structure.activeGroup}</span>
  </span>
));

/**
 * One owner's tree, with a drag context of its own. The plot and the house are
 * two compositions rather than two branches of one, so a term dragged out of a
 * section has nowhere to land in the other and must not be offered the chance.
 */
export const GroupSection = observer(
  ({
    store,
    owner,
    title,
    emptyHint,
    onRemove,
  }: {
    readonly store: SitePlannerStore;
    readonly owner: ShapeOwner;
    readonly title: string;
    readonly emptyHint: string;
    /** Removes the whole composition — only the named buildings offer it. */
    readonly onRemove?: VoidFunction;
  }) => {
    const terms = resolveTerms(store, owner) ?? NO_TERMS;
    const { resolvedActiveGroup } = store.composition;
    const isActive = resolvedActiveGroup.owner === owner && isNil(resolvedActiveGroup.groupId);
    const handleActivate = useFunction(() => store.composition.setActiveGroup(owner));

    const sensors = useSensors(
      useSensor(PointerSensor, {
        activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE_PX },
      })
    );
    const [draggedOperandId, setDraggedOperandId] = useState<ShapeId | undefined>(undefined);

    const draggedOperand = useMemo(
      () => (isNil(draggedOperandId) ? undefined : findTerm({ terms }, draggedOperandId)?.operand),
      [terms, draggedOperandId]
    );
    const blockedGroupIds = useMemo(
      () =>
        isNil(draggedOperand) || !isShapeGroup(draggedOperand)
          ? NO_BLOCKED_GROUP_IDS
          : collectGroupSubtreeIds(draggedOperand),
      [draggedOperand]
    );

    const handleDragStart = useFunction(({ active }: DragStartEvent) => {
      setDraggedOperandId(active.id as ShapeId);
    });
    const handleDragCancel = useFunction(() => {
      setDraggedOperandId(undefined);
    });
    const handleDragEnd = useFunction(({ active, over }: DragEndEvent) => {
      setDraggedOperandId(undefined);

      const target = readDropTarget(over?.data.current);

      if (!isNil(target)) {
        store.composition.moveTerm(owner, active.id as ShapeId, target.groupId, target.index);
      }
    });

    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-pressed={isActive}
            title={isActive ? sitePlannerT.structure.activeGroup : undefined}
            onClick={handleActivate}
            className={cn(
              'flex min-w-0 flex-1 items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs',
              'font-medium transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              isActive ? 'bg-brand-500/20 text-text' : 'text-text-secondary hover:bg-white/10'
            )}
          >
            <span className="truncate">{title}</span>
            {isActive ? <ActiveGroupChip /> : undefined}
          </button>
          {isNil(onRemove) ? undefined : (
            <button
              type="button"
              aria-label={sitePlannerT.structure.removeBuilding}
              onClick={onRemove}
              className={ACTION_BUTTON_CLASS}
            >
              <Trash2 size={ICON_SIZE_PX} aria-hidden />
            </button>
          )}
        </div>

        {terms.length === 0 ? (
          <PanelHint className="px-2 py-1">{emptyHint}</PanelHint>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <TermList
              store={store}
              owner={owner}
              terms={terms}
              depth={0}
              groupId={undefined}
              blockedGroupIds={blockedGroupIds}
            />
            <DragOverlay dropAnimation={null}>
              {isNil(draggedOperand) ? undefined : <TermDragPreview operand={draggedOperand} />}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    );
  }
);

function resolveTerms(store: SitePlannerStore, owner: ShapeOwner): readonly CsgTerm[] | undefined {
  if (owner === 'boundary') {
    return store.boundary.terms;
  }

  return store.buildings.find(building => building.id === owner)?.composition.terms;
}
