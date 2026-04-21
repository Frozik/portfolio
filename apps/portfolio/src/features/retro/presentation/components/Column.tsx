import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useFunction } from '@frozik/components';
import { observer } from 'mobx-react-lite';
import { memo, useMemo } from 'react';

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
import { retroEnTranslations as t } from '../translations/en';
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
    transform,
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

  const dragStyle =
    transform === null
      ? undefined
      : { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` };

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
        style={dragStyle}
        className={cn(isDragging && 'opacity-50', canDrag && 'cursor-grab active:cursor-grabbing')}
        {...attributes}
        {...listeners}
      >
        <CardView
          card={card}
          isOwn={isOwn}
          phase={phase}
          showVotes={showVotes}
          voteCount={voteCount}
          staggerIndex={staggerIndex}
          voteSlot={<VoteButton store={store} targetId={card.id} />}
          onDelete={isOwn ? handleDelete : undefined}
          onEdit={isOwn ? handleEdit : undefined}
        />
      </div>
    </div>
  );
};

const CARD_DROPPABLE_DATA = { type: 'card' } as const;
const COLUMN_DROPPABLE_DATA = { type: 'column' } as const;

type RenderItem =
  | { kind: 'card'; card: IRetroCard }
  | { kind: 'group'; id: GroupId; cards: readonly IRetroCard[] };

function buildRenderItems(cards: readonly IRetroCard[]): RenderItem[] {
  const items: RenderItem[] = [];
  const seenGroups = new Set<GroupId>();
  cards.forEach(card => {
    if (card.groupId === null) {
      items.push({ kind: 'card', card });
      return;
    }
    if (seenGroups.has(card.groupId)) {
      return;
    }
    seenGroups.add(card.groupId);
    const cardsInGroup = cards.filter(candidate => candidate.groupId === card.groupId);
    items.push({ kind: 'group', id: card.groupId, cards: cardsInGroup });
  });
  return items;
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

      <ul className="flex max-h-[480px] flex-col gap-2 overflow-y-auto pr-1">
        {renderItems.map((item, itemIndex) => {
          if (item.kind === 'card') {
            const { card } = item;
            const isOwn = card.authorClientId === myClientId;
            const voteCount = countTotalVotesOnTarget(votesByTarget, card.id);
            return (
              <li key={card.id}>
                <ColumnCardItem
                  card={card}
                  isOwn={isOwn}
                  phase={phase}
                  showVotes={showVotes}
                  voteCount={voteCount}
                  staggerIndex={itemIndex}
                  store={store}
                  onDeleteCard={onDeleteCard}
                  onEditCard={onEditCard}
                />
              </li>
            );
          }
          const groupVoteCount = countTotalVotesOnTarget(votesByTarget, item.id);
          return (
            <li key={item.id}>
              <div className="flex flex-col gap-2 rounded-md border border-brand-500/40 bg-surface-overlay/60 p-2">
                <div className="flex items-center justify-between gap-2 px-1 text-xs text-text-muted">
                  <span className="font-medium">
                    {t.room.groupLabel} · {item.cards.length}
                  </span>
                  {showVotes && groupVoteCount > 0 && (
                    <span className="inline-flex items-center rounded-full bg-brand-500/10 px-2 py-0.5 text-xs font-medium text-brand-200">
                      {groupVoteCount}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  {item.cards.map((card, innerIndex) => {
                    const isOwn = card.authorClientId === myClientId;
                    const voteCount = countTotalVotesOnTarget(votesByTarget, card.id);
                    return (
                      <ColumnCardItem
                        key={card.id}
                        card={card}
                        isOwn={isOwn}
                        phase={phase}
                        showVotes={showVotes}
                        voteCount={voteCount}
                        staggerIndex={itemIndex + innerIndex}
                        store={store}
                        onDeleteCard={onDeleteCard}
                        onEditCard={onEditCard}
                      />
                    );
                  })}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {isBrainstorm && <AddCardForm columnId={column.id} store={store} onSubmit={handleAddCard} />}
    </div>
  );
};

export const Column = memo(observer(ColumnComponent));

export type { ColumnProps };
