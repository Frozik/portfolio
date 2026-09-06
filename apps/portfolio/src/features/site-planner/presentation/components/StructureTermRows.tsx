import { useDraggable, useDroppable } from '@dnd-kit/core';
import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';
import { Folder, FolderOutput } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { Fragment } from 'react';
import type { SitePlannerStore } from '../../application/SitePlannerStore';
import type { ShapeOwner } from '../../domain/model/selection';
import type { CsgOperation, CsgTerm, ShapeGroup, ShapeId } from '../../domain/model/shapes';
import { sitePlannerT } from '../translations';
import { PanelHint } from './PanelHint';
import { TermOperationToggle, TermActions, ShapeTermRow } from './ShapeTermRow';
import { describeGroup } from './structure-term-labels';
import {
  ICON_SIZE_PX,
  ACTION_BUTTON_CLASS,
  TERM_ROW_CLASS,
  TERM_LABEL_CLASS,
  indentClass,
} from './structure-term-styles';
import { TermDragHandle, TermDropGap } from './StructureTermDrag';

/** Dropping on the row of a group means the end of it, wherever its end is. */
const APPEND_TO_GROUP_INDEX = Number.MAX_SAFE_INTEGER;

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
    const { selection } = store;
    const { resolvedActiveGroup } = store.composition;
    const isSelected =
      !isNil(selection) && selection.kind === 'group' && selection.groupId === group.id;
    const isActive =
      resolvedActiveGroup.owner === owner && resolvedActiveGroup.groupId === group.id;
    const label = describeGroup(group);

    const handleSelect = useFunction(() => {
      store.setSelection({ kind: 'group', owner, groupId: group.id });
      store.composition.setActiveGroup(owner, group.id);
    });
    const handleUngroup = useFunction(() => store.composition.ungroupTerm(owner, group.id));

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
      case 'ellipse':
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
export const TermList = observer(
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
