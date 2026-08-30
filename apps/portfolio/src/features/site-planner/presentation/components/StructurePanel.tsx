import type {
  DragEndEvent,
  DraggableAttributes,
  DraggableSyntheticListeners,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { useIsCoarsePointer } from '@frozik/components/hooks/useIsCoarsePointer';
import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';
import type { LucideIcon } from 'lucide-react';
import {
  Car,
  ChevronDown,
  ChevronUp,
  Circle,
  Folder,
  FolderOutput,
  GripVertical,
  Group,
  Plus,
  Route,
  Square,
  Trash2,
  TreePine,
} from 'lucide-react';
import { observer } from 'mobx-react-lite';
import type { ReactNode } from 'react';
import { Fragment, memo, useMemo, useState } from 'react';
import { Button } from '../../../../shared/ui/Button';
import { Dropdown, DropdownItem } from '../../../../shared/ui/Dropdown';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { BuildingPresetId } from '../../domain/model/building-presets';
import { BUILDING_PRESETS } from '../../domain/model/building-presets';
import type { ShapeOwner } from '../../domain/model/selection';
import type {
  CsgOperand,
  CsgOperation,
  CsgTerm,
  Shape,
  ShapeGroup,
  ShapeId,
} from '../../domain/model/shapes';
import {
  collectGroupSubtreeIds,
  findTerm,
  flattenShapes,
  isShapeGroup,
} from '../../domain/model/shapes';
import type { Building, CarInstance, SitePath, TreeInstance } from '../../domain/model/site-plan';
import { uniformPathWidth } from '../../domain/model/site-plan';
import { formatMeters } from '../../domain/plan-draw/shared';
import { DEGREE_DECIMALS, METER_DECIMALS } from '../constants';
import { sitePlannerT } from '../translations';
import { PanelHint } from './PanelHint';
import { PlannerPanel } from './PlannerPanel';

const ICON_SIZE_PX = 14;
const CHIP_ICON_SIZE_PX = 10;
const UNION_GLYPH = '∪';
const SUBTRACT_GLYPH = '−';
const DEGREE_GLYPH = '°';
const DIMENSION_SEPARATOR = ' × ';

/**
 * How far each level of nesting steps in, on top of the row's own `px-1`. The
 * indent stops growing past the last step: the panel is narrow, and the folder
 * rows standing above a term already say where in the tree it sits.
 */
const INDENT_CLASSES = ['', 'pl-4', 'pl-7', 'pl-10'] as const;

/** Shared by a section whose composition does not exist yet. */
const NO_TERMS: readonly CsgTerm[] = [];

/**
 * How far a grip travels before the row it holds starts moving. Enough that a
 * finger dragging the panel scrolls it instead of picking a term up, short
 * enough that a deliberate drag starts where the user expects it to.
 */
const DRAG_ACTIVATION_DISTANCE_PX = 4;

/** Dropping on the row of a group means the end of it, wherever its end is. */
const APPEND_TO_GROUP_INDEX = Number.MAX_SAFE_INTEGER;

/** Names the term list of the composition itself in the id of a drop zone. */
const ROOT_DROP_KEY = 'root';

/** Shared by every section that has no group in flight. */
const NO_BLOCKED_GROUP_IDS: ReadonlySet<ShapeId> = new Set();

const ACTION_BUTTON_CLASS = cn(
  'flex size-6 shrink-0 items-center justify-center rounded text-text-secondary',
  'transition-colors duration-150 hover:bg-white/10 hover:text-text',
  'disabled:cursor-not-allowed disabled:text-text-muted disabled:hover:bg-transparent',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
);

const TERM_ROW_CLASS = 'group/term relative flex items-center gap-0.5 rounded-lg px-1 py-0.5';

const TERM_LABEL_CLASS = cn(
  'flex min-w-0 flex-1 items-center gap-2 rounded px-1 py-1 text-left',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'
);

/**
 * The tail of a term row floats over the end of the label instead of standing in
 * the row: the panel is 264 px wide, and six buttons abreast left the label with
 * three characters. Reserving no width for them is what keeps the label whole,
 * so the cluster carries a background of its own to cover what it hides.
 */
const HOVER_ACTIONS_CLASS = cn(
  'absolute top-1/2 right-1 -translate-y-1/2 rounded-lg px-0.5',
  'border border-white/10 bg-surface-overlay shadow-lg',
  'pointer-events-none opacity-0 transition-opacity duration-150',
  'group-hover/term:pointer-events-auto group-hover/term:opacity-100',
  'group-focus-within/term:pointer-events-auto group-focus-within/term:opacity-100'
);

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
const TermDragHandle = memo(
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
const TermDropGap = memo(
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
const TermDragPreview = memo(({ operand }: { readonly operand: CsgOperand }) => {
  const OperandIcon = operandIcon(operand);

  return (
    <div className="flex items-center gap-2 rounded-lg border border-brand-500/40 bg-surface-overlay px-2 py-1 text-[11px] text-text shadow-lg">
      <OperandIcon size={ICON_SIZE_PX} className="shrink-0" aria-hidden />
      <span className="truncate">{describeOperand(operand)}</span>
    </div>
  );
});

/**
 * How a term joins the fold. It stands next to the grip rather than in the
 * cluster of actions: the operation is what the row *is*, and reading it must
 * not depend on pointing at the row first.
 */
const TermOperationToggle = observer(
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
    const handleToggleOperation = useFunction(() => store.toggleTermOperation(owner, operandId));

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
const TermActions = observer(
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

    const handleMoveUp = useFunction(() => store.reorderTerm(owner, operandId, index - 1));
    const handleMoveDown = useFunction(() => store.reorderTerm(owner, operandId, index + 1));
    const handleRemove = useFunction(() => store.removeTerm(owner, operandId));

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

const ShapeTermRow = observer(
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
    const handleWrapInGroup = useFunction(() => store.wrapTermInGroup(owner, shape.id));

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

/**
 * A nested composition: its own row, and the tree of its terms beneath it.
 * Picking it both selects it and makes it the group new shapes land in — the two
 * are one intent, and separating them would cost a second click every time.
 */
const GroupTermRow = observer(
  ({
    store,
    owner,
    group,
    operation,
    index,
    termCount,
    depth,
    blockedGroupIds,
  }: {
    readonly store: SitePlannerStore;
    readonly owner: ShapeOwner;
    readonly group: ShapeGroup;
    readonly operation: CsgOperation;
    readonly index: number;
    readonly termCount: number;
    readonly depth: number;
    readonly blockedGroupIds: ReadonlySet<ShapeId>;
  }) => {
    const { selection, resolvedActiveGroup } = store;
    const isSelected =
      !isNil(selection) && selection.kind === 'group' && selection.groupId === group.id;
    const isActive =
      resolvedActiveGroup.owner === owner && resolvedActiveGroup.groupId === group.id;
    const label = describeGroup(group);

    const handleSelect = useFunction(() => {
      store.setSelection({ kind: 'group', owner, groupId: group.id });
      store.setActiveGroup(owner, group.id);
    });
    const handleUngroup = useFunction(() => store.ungroupTerm(owner, group.id));

    const isDropBlocked = blockedGroupIds.has(group.id);
    const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
      id: group.id,
    });
    const { setNodeRef: setDropNodeRef, isOver } = useDroppable({
      id: `group:${group.id}`,
      data: { groupId: group.id, index: APPEND_TO_GROUP_INDEX },
      disabled: isDropBlocked,
    });

    return (
      <li className="flex flex-col">
        <div ref={setDropNodeRef}>
          <div
            ref={setNodeRef}
            className={cn(
              TERM_ROW_CLASS,
              indentClass(depth),
              isSelected ? 'bg-brand-500/20' : 'hover:bg-white/5',
              isDragging && 'opacity-40',
              isOver && 'ring-1 ring-brand-500'
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
              operandId={group.id}
              operation={operation}
            />

            <button
              type="button"
              aria-pressed={isSelected}
              title={isActive ? `${label} — ${sitePlannerT.structure.activeGroup}` : label}
              onClick={handleSelect}
              className={cn(TERM_LABEL_CLASS, isSelected ? 'text-text' : 'text-text-secondary')}
            >
              <Folder
                size={ICON_SIZE_PX}
                className={cn('shrink-0', isActive && 'text-brand-500')}
                aria-hidden
              />
              <span className="truncate text-[11px]">{label}</span>
            </button>

            <TermActions
              store={store}
              owner={owner}
              operandId={group.id}
              index={index}
              termCount={termCount}
              removeLabel={sitePlannerT.structure.removeGroup}
              extraAction={
                <button
                  type="button"
                  aria-label={sitePlannerT.structure.ungroup}
                  onClick={handleUngroup}
                  className={ACTION_BUTTON_CLASS}
                >
                  <FolderOutput size={ICON_SIZE_PX} aria-hidden />
                </button>
              }
            />
          </div>
        </div>

        {group.terms.length === 0 ? (
          <PanelHint className={cn('py-1 pl-2', indentClass(depth + 1))}>
            {sitePlannerT.structure.emptyBoundary}
          </PanelHint>
        ) : (
          <TermList
            store={store}
            owner={owner}
            terms={group.terms}
            depth={depth + 1}
            groupId={group.id}
            blockedGroupIds={blockedGroupIds}
          />
        )}
      </li>
    );
  }
);

const TermRow = observer(
  ({
    store,
    owner,
    term,
    index,
    termCount,
    depth,
    blockedGroupIds,
  }: {
    readonly store: SitePlannerStore;
    readonly owner: ShapeOwner;
    readonly term: CsgTerm;
    readonly index: number;
    readonly termCount: number;
    readonly depth: number;
    readonly blockedGroupIds: ReadonlySet<ShapeId>;
  }) => {
    const { operand, operation } = term;

    switch (operand.kind) {
      case 'group':
        return (
          <GroupTermRow
            store={store}
            owner={owner}
            group={operand}
            operation={operation}
            index={index}
            termCount={termCount}
            depth={depth}
            blockedGroupIds={blockedGroupIds}
          />
        );
      case 'rectangle':
      case 'circle':
        return (
          <ShapeTermRow
            store={store}
            owner={owner}
            shape={operand}
            operation={operation}
            index={index}
            termCount={termCount}
            depth={depth}
          />
        );
      default:
        return assertNever(operand);
    }
  }
);

/**
 * The terms of one list, with a drop zone in every seam between them. The list
 * of a group being dragged takes no drops at all: a term cannot land inside the
 * subtree that is travelling with it.
 */
const TermList = observer(
  ({
    store,
    owner,
    terms,
    depth,
    groupId,
    blockedGroupIds,
  }: {
    readonly store: SitePlannerStore;
    readonly owner: ShapeOwner;
    readonly terms: readonly CsgTerm[];
    readonly depth: number;
    readonly groupId: ShapeId | undefined;
    readonly blockedGroupIds: ReadonlySet<ShapeId>;
  }) => {
    const isDropBlocked = !isNil(groupId) && blockedGroupIds.has(groupId);

    return (
      <ul className="flex flex-col">
        {terms.map((term, index) => (
          <Fragment key={term.operand.id}>
            <TermDropGap groupId={groupId} index={index} depth={depth} isDisabled={isDropBlocked} />
            <TermRow
              store={store}
              owner={owner}
              term={term}
              index={index}
              termCount={terms.length}
              depth={depth}
              blockedGroupIds={blockedGroupIds}
            />
          </Fragment>
        ))}
        <TermDropGap
          groupId={groupId}
          index={terms.length}
          depth={depth}
          isDisabled={isDropBlocked}
        />
      </ul>
    );
  }
);

/**
 * One owner's tree, with a drag context of its own. The plot and the house are
 * two compositions rather than two branches of one, so a term dragged out of a
 * section has nowhere to land in the other and must not be offered the chance.
 */
const GroupSection = observer(
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
    const { resolvedActiveGroup } = store;
    const isActive = resolvedActiveGroup.owner === owner && isNil(resolvedActiveGroup.groupId);
    const handleActivate = useFunction(() => store.setActiveGroup(owner));

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
        store.moveTerm(owner, active.id as ShapeId, target.groupId, target.index);
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

/**
 * A row of the placed objects: what it is on the left, the button that removes
 * it on the right. Trees and paths are listed rather than folded — they are
 * instances, not terms of a composition, so there is no operation to toggle and
 * no order to keep.
 */
const ObjectRow = memo(
  ({
    label,
    detail,
    isSelected,
    removeLabel,
    onSelect,
    onRemove,
  }: {
    readonly label: string;
    readonly detail: string;
    readonly isSelected: boolean;
    readonly removeLabel: string;
    readonly onSelect: VoidFunction;
    readonly onRemove: VoidFunction;
  }) => (
    <li
      className={cn(
        'flex items-center gap-0.5 rounded-lg px-1 py-0.5',
        isSelected ? 'bg-brand-500/20' : 'hover:bg-white/5'
      )}
    >
      <button
        type="button"
        aria-pressed={isSelected}
        onClick={onSelect}
        className={cn(
          'flex min-w-0 flex-1 items-center justify-between gap-2 rounded px-1 py-1 text-left',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
          isSelected ? 'text-text' : 'text-text-secondary'
        )}
      >
        <span className="truncate text-[11px]">{label}</span>
        <span className="shrink-0 font-mono text-[11px] text-text">{detail}</span>
      </button>

      <button
        type="button"
        aria-label={removeLabel}
        onClick={onRemove}
        className={ACTION_BUTTON_CLASS}
      >
        <Trash2 size={ICON_SIZE_PX} aria-hidden />
      </button>
    </li>
  )
);

/** Header and body of a list section; the count reads as the plot's inventory. */
const ObjectSection = memo(
  ({
    icon: Icon,
    title,
    count,
    emptyHint,
    children,
  }: {
    readonly icon: LucideIcon;
    readonly title: string;
    readonly count: number;
    readonly emptyHint: string;
    readonly children: ReactNode;
  }) => (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5">
        <span className="flex items-center gap-2 text-xs font-medium text-text-secondary">
          <Icon size={ICON_SIZE_PX} aria-hidden />
          {title}
        </span>
        <span className="font-mono text-[10px] text-text-muted">{count}</span>
      </div>

      {count === 0 ? (
        <PanelHint className="px-2 py-1">{emptyHint}</PanelHint>
      ) : (
        <ul className="flex flex-col">{children}</ul>
      )}
    </div>
  )
);

const TreeRow = observer(
  ({ store, tree }: { readonly store: SitePlannerStore; readonly tree: TreeInstance }) => {
    const { selection } = store;
    const isSelected =
      !isNil(selection) && selection.kind === 'tree' && selection.treeId === tree.id;

    const handleSelect = useFunction(() => store.setSelection({ kind: 'tree', treeId: tree.id }));
    const handleRemove = useFunction(() => store.removeTree(tree.id));

    return (
      <ObjectRow
        label={sitePlannerT.properties.species[tree.species]}
        detail={`${sitePlannerT.structure.radiusPrefix} ${formatMeters(tree.crownRadius, sitePlannerT.plan.meterUnit)}`}
        isSelected={isSelected}
        removeLabel={sitePlannerT.structure.removeTree}
        onSelect={handleSelect}
        onRemove={handleRemove}
      />
    );
  }
);

const CarRow = observer(
  ({ store, car }: { readonly store: SitePlannerStore; readonly car: CarInstance }) => {
    const { selection } = store;
    const isSelected = !isNil(selection) && selection.kind === 'car' && selection.carId === car.id;

    const handleSelect = useFunction(() => store.setSelection({ kind: 'car', carId: car.id }));
    const handleRemove = useFunction(() => store.removeCar(car.id));

    return (
      <ObjectRow
        label={sitePlannerT.properties.car}
        detail={`${car.rotationDegrees.toFixed(DEGREE_DECIMALS)}${DEGREE_GLYPH}`}
        isSelected={isSelected}
        removeLabel={sitePlannerT.structure.removeCar}
        onSelect={handleSelect}
        onRemove={handleRemove}
      />
    );
  }
);

const PathRow = observer(
  ({ store, path }: { readonly store: SitePlannerStore; readonly path: SitePath }) => {
    const { selection } = store;
    const isSelected =
      !isNil(selection) && selection.kind === 'path' && selection.pathId === path.id;

    const handleSelect = useFunction(() => store.setSelection({ kind: 'path', pathId: path.id }));
    const handleRemove = useFunction(() => store.removePath(path.id));

    return (
      <ObjectRow
        label={`${path.points.length} ${sitePlannerT.structure.pointCountSuffix}`}
        detail={formatPathWidth(path)}
        isSelected={isSelected}
        removeLabel={sitePlannerT.structure.removePath}
        onSelect={handleSelect}
        onRemove={handleRemove}
      />
    );
  }
);

const TreesSection = observer(({ store }: { readonly store: SitePlannerStore }) => (
  <ObjectSection
    icon={TreePine}
    title={sitePlannerT.structure.trees}
    count={store.trees.length}
    emptyHint={sitePlannerT.structure.emptyTrees}
  >
    {store.trees.map(tree => (
      <TreeRow key={tree.id} store={store} tree={tree} />
    ))}
  </ObjectSection>
));

const CarsSection = observer(({ store }: { readonly store: SitePlannerStore }) => (
  <ObjectSection
    icon={Car}
    title={sitePlannerT.structure.cars}
    count={store.cars.length}
    emptyHint={sitePlannerT.structure.emptyCars}
  >
    {store.cars.map(car => (
      <CarRow key={car.id} store={store} car={car} />
    ))}
  </ObjectSection>
));

const PathsSection = observer(({ store }: { readonly store: SitePlannerStore }) => (
  <ObjectSection
    icon={Route}
    title={sitePlannerT.structure.paths}
    count={store.paths.length}
    emptyHint={sitePlannerT.structure.emptyPaths}
  >
    {store.paths.map(path => (
      <PathRow key={path.id} store={store} path={path} />
    ))}
  </ObjectSection>
));

/**
 * The scene tree: the plot and the house with their CSG terms. Selecting a group
 * header is what decides where a newly drawn shape lands. Lives in site editing
 * — reshaping the ground plan is what that mode is (see modes.md).
 */
/** One preset in the add-building menu: дом, сарай, навес (R19 — data, not editors). */
const BuildingPresetItem = memo(
  ({
    presetId,
    onSelect,
  }: {
    readonly presetId: BuildingPresetId;
    readonly onSelect: (presetId: BuildingPresetId) => void;
  }) => {
    const handleSelect = useFunction(() => onSelect(presetId));

    return (
      <DropdownItem onSelect={handleSelect} className="gap-2 py-1.5 text-xs">
        <Plus size={ICON_SIZE_PX} className="shrink-0" aria-hidden />
        {sitePlannerT.structure.presets[presetId]}
      </DropdownItem>
    );
  }
);

export const StructurePanel = observer(({ store }: { readonly store: SitePlannerStore }) => {
  const handleAddBuilding = useFunction((presetId: BuildingPresetId) => {
    store.addBuilding(
      `${sitePlannerT.structure.presets[presetId]} ${store.buildings.length + 1}`,
      presetId
    );
  });

  return (
    <PlannerPanel title={sitePlannerT.structure.title}>
      <GroupSection
        store={store}
        owner="boundary"
        title={sitePlannerT.structure.boundary}
        emptyHint={sitePlannerT.structure.emptyBoundary}
      />
      {store.buildings.map(building => (
        <BuildingSection key={building.id} store={store} building={building} />
      ))}
      <Dropdown
        trigger={
          <Button variant="ghost" size="sm">
            <Plus size={ICON_SIZE_PX} aria-hidden />
            {sitePlannerT.structure.addBuilding}
          </Button>
        }
      >
        {BUILDING_PRESETS.map(preset => (
          <BuildingPresetItem key={preset.id} presetId={preset.id} onSelect={handleAddBuilding} />
        ))}
      </Dropdown>
    </PlannerPanel>
  );
});

/** One named structure: its term tree under its name, removable as a whole. */
const BuildingSection = observer(
  ({ store, building }: { readonly store: SitePlannerStore; readonly building: Building }) => {
    const handleRemove = useFunction(() => store.removeBuilding(building.id));

    return (
      <GroupSection
        store={store}
        owner={building.id}
        title={building.name}
        emptyHint={sitePlannerT.structure.emptyHouse}
        onRemove={handleRemove}
      />
    );
  }
);

/**
 * View mode's inventory: the objects standing on the plot as flat lists. The
 * plot's own anatomy is behind «Редактировать участок» — this card is for what
 * is placed, not for what is drawn.
 */
export const ObjectsPanel = observer(({ store }: { readonly store: SitePlannerStore }) => (
  <PlannerPanel title={sitePlannerT.objects.title}>
    <TreesSection store={store} />
    <CarsSection store={store} />
    <PathsSection store={store} />
  </PlannerPanel>
));

function resolveTerms(store: SitePlannerStore, owner: ShapeOwner): readonly CsgTerm[] | undefined {
  if (owner === 'boundary') {
    return store.boundary.terms;
  }

  return store.buildings.find(building => building.id === owner)?.composition.terms;
}

function indentClass(depth: number): string {
  return INDENT_CLASSES[Math.min(depth, INDENT_CLASSES.length - 1)];
}

/**
 * Reads back what a drop zone was carrying. The payload leaves the tree through
 * dnd-kit, which types it as free-form data, so it is checked on the way back in
 * rather than taken on trust.
 */
function readDropTarget(data: Record<string, unknown> | undefined): TermDropTarget | undefined {
  const index = data?.index;
  const groupId = data?.groupId;

  if (typeof index !== 'number') {
    return undefined;
  }

  return { index, groupId: typeof groupId === 'string' ? (groupId as ShapeId) : undefined };
}

function operandIcon(operand: CsgOperand): LucideIcon {
  switch (operand.kind) {
    case 'group':
      return Folder;
    case 'rectangle':
      return Square;
    case 'circle':
      return Circle;
    default:
      return assertNever(operand);
  }
}

function describeOperand(operand: CsgOperand): string {
  return isShapeGroup(operand) ? describeGroup(operand) : describeShape(operand);
}

function describeGroup(group: ShapeGroup): string {
  return `${sitePlannerT.structure.group} (${flattenShapes(group).length})`;
}

/** One width reads as that width; a varying ribbon reads as its range. */
function formatPathWidth(path: SitePath): string {
  const { meterUnit } = sitePlannerT.plan;
  const uniform = uniformPathWidth(path);

  if (!isNil(uniform)) {
    return formatMeters(uniform, meterUnit);
  }

  const widths = path.points.map(point => point.width);

  return `${Math.min(...widths).toFixed(METER_DECIMALS)}–${formatMeters(Math.max(...widths), meterUnit)}`;
}

function describeShape(shape: Shape): string {
  const { meterUnit } = sitePlannerT.plan;

  switch (shape.kind) {
    case 'rectangle':
      return `${shape.width.toFixed(METER_DECIMALS)}${DIMENSION_SEPARATOR}${formatMeters(shape.length, meterUnit)}`;
    case 'circle':
      return `${sitePlannerT.structure.radiusPrefix} ${formatMeters(shape.radius, meterUnit)}`;
    default:
      return assertNever(shape);
  }
}
