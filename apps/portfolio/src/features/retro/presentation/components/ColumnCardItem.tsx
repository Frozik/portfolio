import { useDraggable, useDroppable } from '@dnd-kit/core';
import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import type { ReactNode } from 'react';
import { memo } from 'react';

import type { CardId, ClientId, IRetroCard, RetroPhase } from '../../domain/types';
import { CardView } from './CardView';

const CARD_DROPPABLE_DATA = { type: 'card' } as const;

/** A card that can be dragged to reorder and dropped onto to form a group. */
const ColumnCardItemComponent = ({
  card,
  cardIndex,
  columnAccentColor,
  isOwn,
  myClientId,
  phase,
  showVotes,
  voteCount,
  staggerIndex,
  voteSlot,
  onDeleteCard,
  onEditCard,
}: {
  readonly card: IRetroCard;
  readonly cardIndex: number;
  readonly columnAccentColor: string;
  readonly isOwn: boolean;
  readonly myClientId: ClientId;
  readonly phase: RetroPhase;
  readonly showVotes: boolean;
  readonly voteCount: number;
  readonly staggerIndex: number;
  readonly voteSlot: ReactNode | undefined;
  readonly onDeleteCard: (cardId: CardId) => void;
  readonly onEditCard: (cardId: CardId, text: string) => void;
}) => {
  const handleDelete = useFunction(() => {
    onDeleteCard(card.id);
  });
  const handleEdit = useFunction((text: string) => {
    onEditCard(card.id, text);
  });

  const dndEnabled = phase === 'brainstorm' || phase === 'group';
  const canDrag = dndEnabled && (phase === 'group' || isOwn);
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({ id: card.id, disabled: !canDrag });
  const {
    setNodeRef: setDropRef,
    isOver,
    active,
  } = useDroppable({ id: card.id, data: CARD_DROPPABLE_DATA, disabled: !dndEnabled });

  const showMergeHint = isOver && !isNil(active) && active.id !== card.id;

  return (
    <div
      ref={setDropRef}
      className={cn(
        'transition-shadow',
        showMergeHint && 'ring-1 ring-landing-accent/60 ring-offset-2 ring-offset-landing-bg'
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
          cardIndex={cardIndex}
          accentColor={columnAccentColor}
          isOwn={isOwn}
          myClientId={myClientId}
          phase={phase}
          showVotes={showVotes && !isNil(voteSlot)}
          voteCount={voteCount}
          staggerIndex={staggerIndex}
          voteSlot={voteSlot}
          onDelete={isOwn && dndEnabled ? handleDelete : undefined}
          onEdit={isOwn && dndEnabled ? handleEdit : undefined}
        />
      </div>
    </div>
  );
};

export const ColumnCardItem = memo(ColumnCardItemComponent);
