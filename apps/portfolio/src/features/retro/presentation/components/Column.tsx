import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useFunction } from '@frozik/components';
import { observer } from 'mobx-react-lite';
import { Fragment, memo, useMemo } from 'react';

import { cn } from '../../../../shared/lib/cn';
import type { RoomStore } from '../../application/RoomStore';
import type {
  CardId,
  ClientId,
  ColumnId,
  GroupId,
  IColumnConfig,
  IRetroCard,
  VotesByTarget,
} from '../../domain/types';
import { ERetroPhase } from '../../domain/types';
import { countTotalVotesOnTarget } from '../../domain/voting';
import { retroT as t } from '../translations';
import { AddCardForm } from './AddCardForm';
import { CardView } from './CardView';
import { VoteButton } from './VoteButton';

interface ColumnCardItemProps {
  card: IRetroCard;
  isOwn: boolean;
  phase: ERetroPhase;
  showVotes: boolean;
  voteCount: number;
  staggerIndex: number;
  store: RoomStore;
  showVoteButton: boolean;
  onDeleteCard: (cardId: CardId) => void;
  onEditCard: (cardId: CardId, text: string) => void;
}

const ColumnCardItemComponent = ({
  card,
  isOwn,
  phase,
  showVotes,
  voteCount,
  staggerIndex,
  store,
  showVoteButton,
  onDeleteCard,
  onEditCard,
}: ColumnCardItemProps) => {
  const handleDelete = useFunction(() => {
    onDeleteCard(card.id);
  });

  const handleEdit = useFunction((text: string) => {
    onEditCard(card.id, text);
  });

  const dndEnabled = phase === ERetroPhase.Brainstorm || phase === ERetroPhase.Group;
  const canDrag = dndEnabled && (phase === ERetroPhase.Group || isOwn);
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: card.id,
    disabled: !canDrag,
  });
  const {
    setNodeRef: setDropRef,
    isOver,
    active,
  } = useDroppable({
    id: card.id,
    data: CARD_DROPPABLE_DATA,
    disabled: !dndEnabled,
  });

  const showMergeHint = isOver && active !== null && active.id !== card.id;

  return (
    <div
      ref={setDropRef}
      className={cn(
        'rounded-md transition-shadow',
        showMergeHint && 'ring-2 ring-brand-400 ring-offset-1 ring-offset-surface'
      )}
    >
      <div
        ref={setDragRef}
        className={cn(
          isDragging && 'opacity-40',
          canDrag && 'cursor-grab touch-manipulation select-none active:cursor-grabbing'
        )}
        {...attributes}
        {...listeners}
      >
        <CardView
          card={card}
          isOwn={isOwn}
          phase={phase}
          showVotes={showVotes && showVoteButton}
          voteCount={voteCount}
          staggerIndex={staggerIndex}
          voteSlot={showVoteButton ? <VoteButton store={store} targetId={card.id} /> : undefined}
          onDelete={isOwn && dndEnabled ? handleDelete : undefined}
          onEdit={isOwn && dndEnabled ? handleEdit : undefined}
        />
      </div>
    </div>
  );
};

const CARD_DROPPABLE_DATA = { type: 'card' } as const;
const COLUMN_DROPPABLE_DATA = { type: 'column' } as const;

interface IGapDropData {
  readonly type: 'gap';
  readonly targetColumnId: ColumnId;
  readonly targetIndex: number;
  readonly targetGroupId: GroupId | null;
}

interface GapDropZoneProps {
  id: string;
  data: IGapDropData;
  disabled: boolean;
}

const GapDropZone = ({ id, data, disabled }: GapDropZoneProps) => {
  const { setNodeRef, isOver } = useDroppable({ id, data, disabled });
  return (
    <div ref={setNodeRef} aria-hidden="true" className="relative h-2 shrink-0">
      {isOver && (
        <div className="pointer-events-none absolute inset-x-2 top-1/2 h-1 -translate-y-1/2 rounded-full bg-brand-400" />
      )}
    </div>
  );
};

type TRenderCard = { readonly card: IRetroCard; readonly columnIndex: number };
type RenderItem =
  | { readonly kind: 'card'; readonly card: IRetroCard; readonly columnIndex: number }
  | {
      readonly kind: 'group';
      readonly id: GroupId;
      readonly firstColumnIndex: number;
      readonly cards: readonly TRenderCard[];
    };

function buildRenderItems(cards: readonly IRetroCard[]): readonly RenderItem[] {
  const items: RenderItem[] = [];
  const seenGroups = new Set<GroupId>();
  cards.forEach((card, index) => {
    if (card.groupId === null) {
      items.push({ kind: 'card', card, columnIndex: index });
      return;
    }
    if (seenGroups.has(card.groupId)) {
      return;
    }
    seenGroups.add(card.groupId);
    const cardsInGroup: TRenderCard[] = [];
    cards.forEach((candidate, candidateIndex) => {
      if (candidate.groupId === card.groupId) {
        cardsInGroup.push({ card: candidate, columnIndex: candidateIndex });
      }
    });
    items.push({
      kind: 'group',
      id: card.groupId,
      firstColumnIndex: index,
      cards: cardsInGroup,
    });
  });
  return items;
}

function firstColumnIndexOfItem(item: RenderItem): number {
  return item.kind === 'card' ? item.columnIndex : item.firstColumnIndex;
}

const ColumnCardItem = memo(ColumnCardItemComponent);

interface ColumnProps {
  column: IColumnConfig;
  cards: readonly IRetroCard[];
  phase: ERetroPhase;
  myClientId: ClientId;
  votesByTarget: VotesByTarget;
  store: RoomStore;
  onAddCard: (columnId: ColumnId, text: string) => void;
  onDeleteCard: (cardId: CardId) => void;
  onEditCard: (cardId: CardId, text: string) => void;
}

const ColumnComponent = ({
  column,
  cards,
  phase,
  myClientId,
  votesByTarget,
  store,
  onAddCard,
  onDeleteCard,
  onEditCard,
}: ColumnProps) => {
  const handleAddCard = useFunction((text: string) => {
    onAddCard(column.id, text);
  });

  const columnStyle = useMemo(() => ({ borderLeftColor: column.color }), [column.color]);

  const showVotes = phase === ERetroPhase.Discuss;
  const isBrainstorm = phase === ERetroPhase.Brainstorm;
  const dndEnabled = phase === ERetroPhase.Brainstorm || phase === ERetroPhase.Group;

  const typingOthers = isBrainstorm
    ? store.presentUsers.filter(
        user => user.clientId !== myClientId && user.typingInColumnId === column.id
      )
    : [];

  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: COLUMN_DROPPABLE_DATA,
  });

  const renderItems = useMemo(() => buildRenderItems(cards), [cards]);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex flex-col gap-3 rounded-lg border-l-4 bg-surface p-4 transition-colors',
        isOver && 'bg-surface-elevated ring-2 ring-brand-500/40'
      )}
      style={columnStyle}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-base font-semibold text-text">
          <span aria-hidden="true">{column.emoji}</span>
          <span>{column.title}</span>
        </h3>
        <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-surface-overlay px-2 py-0.5 text-xs font-medium text-text-secondary">
          {cards.length}
        </span>
      </div>

      <p className="text-xs text-text-secondary">{column.prompt}</p>

      {typingOthers.length > 0 && (
        <p className="text-xs italic text-text-muted">
          {typingOthers.length === 1
            ? t.room.someoneIsWriting
            : `${typingOthers.length} ${t.room.multipleWriting}`}
        </p>
      )}

      <ul className="flex max-h-[480px] flex-col overflow-y-auto pr-1">
        {renderItems.map((item, itemIndex) => {
          const columnGapKey = `col-${column.id}-${itemIndex}`;
          const columnGap = (
            <GapDropZone
              id={columnGapKey}
              data={{
                type: 'gap',
                targetColumnId: column.id,
                targetIndex: firstColumnIndexOfItem(item),
                targetGroupId: null,
              }}
              disabled={!dndEnabled}
            />
          );

          if (item.kind === 'card') {
            const { card } = item;
            const isOwn = card.authorClientId === myClientId;
            const voteCount = countTotalVotesOnTarget(votesByTarget, card.id);
            return (
              <Fragment key={card.id}>
                {columnGap}
                <li>
                  <ColumnCardItem
                    card={card}
                    isOwn={isOwn}
                    phase={phase}
                    showVotes={showVotes}
                    voteCount={voteCount}
                    staggerIndex={itemIndex}
                    store={store}
                    showVoteButton
                    onDeleteCard={onDeleteCard}
                    onEditCard={onEditCard}
                  />
                </li>
              </Fragment>
            );
          }

          const lastGroupCardIndex = item.cards[item.cards.length - 1]?.columnIndex ?? -1;

          return (
            <Fragment key={item.id}>
              {columnGap}
              <li>
                <div className="flex flex-col gap-2 rounded-md border border-brand-500/40 bg-surface-elevated p-2">
                  <div className="flex items-center justify-between gap-2 px-1 text-xs">
                    <span className="font-medium text-text-muted">
                      {t.room.groupLabel} · {item.cards.length}
                    </span>
                    <VoteButton store={store} targetId={item.id} />
                  </div>
                  <div className="flex flex-col">
                    {item.cards.map((entry, innerIndex) => {
                      const isOwn = entry.card.authorClientId === myClientId;
                      return (
                        <Fragment key={entry.card.id}>
                          <GapDropZone
                            id={`grp-${item.id}-${innerIndex}`}
                            data={{
                              type: 'gap',
                              targetColumnId: column.id,
                              targetIndex: entry.columnIndex,
                              targetGroupId: item.id,
                            }}
                            disabled={!dndEnabled}
                          />
                          <ColumnCardItem
                            card={entry.card}
                            isOwn={isOwn}
                            phase={phase}
                            showVotes={false}
                            voteCount={0}
                            staggerIndex={itemIndex + innerIndex}
                            store={store}
                            showVoteButton={false}
                            onDeleteCard={onDeleteCard}
                            onEditCard={onEditCard}
                          />
                        </Fragment>
                      );
                    })}
                    <GapDropZone
                      id={`grp-${item.id}-end`}
                      data={{
                        type: 'gap',
                        targetColumnId: column.id,
                        targetIndex: lastGroupCardIndex + 1,
                        targetGroupId: item.id,
                      }}
                      disabled={!dndEnabled}
                    />
                  </div>
                </div>
              </li>
            </Fragment>
          );
        })}
        <GapDropZone
          id={`col-${column.id}-end`}
          data={{
            type: 'gap',
            targetColumnId: column.id,
            targetIndex: cards.length,
            targetGroupId: null,
          }}
          disabled={!dndEnabled}
        />
      </ul>

      {isBrainstorm && <AddCardForm columnId={column.id} store={store} onSubmit={handleAddCard} />}
    </div>
  );
};

export const Column = memo(observer(ColumnComponent));

export type { ColumnProps, IGapDropData };
