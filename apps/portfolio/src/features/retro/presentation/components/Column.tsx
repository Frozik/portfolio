import { useDroppable } from '@dnd-kit/core';
import { cn } from '@frozik/components/components/cn';
import { useFunction } from '@frozik/components/hooks/useFunction';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { Fragment, memo, useMemo } from 'react';

import { CardFrame } from '../../../../shared/ui/CardFrame';
import { MonoKicker } from '../../../../shared/ui/MonoKicker';
import type { RoomStore } from '../../application/RoomStore';
import { canMutateCard, countPeersTypingInColumn } from '../../domain/anonymity';
import type {
  CardId,
  ClientId,
  ColumnId,
  GroupId,
  IColumnConfig,
  IRetroCard,
  RetroPhase,
  VotesByTarget,
} from '../../domain/types';
import { countTotalVotesOnTarget } from '../../domain/voting';
import { retroT } from '../translations';
import { AddCardForm } from './AddCardForm';
import { ColumnCardItem } from './ColumnCardItem';
import { ColumnHeader } from './ColumnHeader';
import { GapDropZone } from './GapDropZone';
import { VoteButton } from './VoteButton';

const COLUMN_DROPPABLE_DATA = { type: 'column' } as const;

interface IRenderCard {
  readonly card: IRetroCard;
  readonly columnIndex: number;
}

type RenderItem =
  | { readonly kind: 'card'; readonly card: IRetroCard; readonly columnIndex: number }
  | {
      readonly kind: 'group';
      readonly id: GroupId;
      readonly firstColumnIndex: number;
      readonly cards: readonly IRenderCard[];
    };

/** Cards in column order, with each group folded into one item at its first card's slot. */
function buildRenderItems(cards: readonly IRetroCard[]): readonly RenderItem[] {
  const items: RenderItem[] = [];
  const seenGroups = new Set<GroupId>();
  cards.forEach((card, index) => {
    if (isNil(card.groupId)) {
      items.push({ kind: 'card', card, columnIndex: index });
      return;
    }
    if (seenGroups.has(card.groupId)) {
      return;
    }
    seenGroups.add(card.groupId);
    const cardsInGroup = cards.flatMap((candidate, candidateIndex) =>
      candidate.groupId === card.groupId ? [{ card: candidate, columnIndex: candidateIndex }] : []
    );
    items.push({ kind: 'group', id: card.groupId, firstColumnIndex: index, cards: cardsInGroup });
  });
  return items;
}

function firstColumnIndexOfItem(item: RenderItem): number {
  return item.kind === 'card' ? item.columnIndex : item.firstColumnIndex;
}

function sumVotesInColumn(cards: readonly IRetroCard[], votesByTarget: VotesByTarget): number {
  let sum = 0;
  for (const card of cards) {
    sum += countTotalVotesOnTarget(votesByTarget, card.id);
    if (!isNil(card.groupId)) {
      sum += countTotalVotesOnTarget(votesByTarget, card.groupId);
    }
  }
  return sum;
}

const ColumnComponent = ({
  column,
  columnIndex,
  cards,
  phase,
  myClientId,
  votesByTarget,
  store,
  onAddCard,
  onDeleteCard,
  onEditCard,
}: {
  readonly column: IColumnConfig;
  readonly columnIndex: number;
  readonly cards: readonly IRetroCard[];
  readonly phase: RetroPhase;
  readonly myClientId: ClientId;
  readonly votesByTarget: VotesByTarget;
  readonly store: RoomStore;
  readonly onAddCard: (columnId: ColumnId, text: string) => void;
  readonly onDeleteCard: (cardId: CardId) => void;
  readonly onEditCard: (cardId: CardId, text: string) => void;
}) => {
  const handleAddCard = useFunction((text: string) => {
    onAddCard(column.id, text);
  });

  const totalVotes = useMemo(() => sumVotesInColumn(cards, votesByTarget), [cards, votesByTarget]);
  const renderItems = useMemo(() => buildRenderItems(cards), [cards]);

  const showVotes = phase === 'discuss';
  const isBrainstorm = phase === 'brainstorm';
  const dndEnabled = phase === 'brainstorm' || phase === 'group';
  const typingPeersCount = isBrainstorm
    ? countPeersTypingInColumn(store.presentUsers, column.id, myClientId)
    : 0;

  const { setNodeRef, isOver } = useDroppable({ id: column.id, data: COLUMN_DROPPABLE_DATA });

  return (
    <div ref={setNodeRef}>
      <CardFrame
        className={cn(
          'flex h-full min-h-[520px] flex-col bg-landing-bg-elev/35 transition-colors',
          isOver && 'border-landing-accent/30 bg-landing-bg-elev/60'
        )}
      >
        <ColumnHeader
          column={column}
          columnIndex={columnIndex}
          cardCount={cards.length}
          totalVotes={totalVotes}
          typingPeersCount={typingPeersCount}
        />

        <ul className="flex flex-1 flex-col p-3.5">
          {cards.length === 0 && (
            <li>
              <div className="border border-dashed border-landing-border-soft px-2.5 py-10 text-center">
                <MonoKicker tone="faint">{retroT.room.noCardsYet}</MonoKicker>
              </div>
            </li>
          )}
          {renderItems.map((item, itemIndex) => {
            const columnGap = (
              <GapDropZone
                id={`col-${column.id}-${itemIndex}`}
                data={{
                  type: 'gap',
                  targetColumnId: column.id,
                  targetIndex: firstColumnIndexOfItem(item),
                  targetGroupId: undefined,
                }}
                disabled={!dndEnabled}
              />
            );

            if (item.kind === 'card') {
              const { card } = item;
              return (
                <Fragment key={card.id}>
                  {columnGap}
                  <li>
                    <ColumnCardItem
                      card={card}
                      cardIndex={item.columnIndex}
                      columnAccentColor={column.color}
                      isOwn={canMutateCard(card, myClientId)}
                      myClientId={myClientId}
                      phase={phase}
                      showVotes={showVotes}
                      voteCount={countTotalVotesOnTarget(votesByTarget, card.id)}
                      staggerIndex={itemIndex}
                      voteSlot={<VoteButton store={store} targetId={card.id} />}
                      onDeleteCard={onDeleteCard}
                      onEditCard={onEditCard}
                    />
                  </li>
                </Fragment>
              );
            }

            const lastGroupCardIndex = item.cards.at(-1)?.columnIndex ?? -1;
            return (
              <Fragment key={item.id}>
                {columnGap}
                <li>
                  <div className="flex flex-col gap-2 border border-landing-accent/40 bg-landing-bg-elev/60 p-2">
                    <div className="flex items-center justify-between gap-2 px-1">
                      <MonoKicker tone="dim">
                        {retroT.room.groupLabel} · {item.cards.length}
                      </MonoKicker>
                      <VoteButton store={store} targetId={item.id} />
                    </div>
                    <div className="flex flex-col">
                      {item.cards.map((entry, innerIndex) => (
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
                            cardIndex={entry.columnIndex}
                            columnAccentColor={column.color}
                            isOwn={canMutateCard(entry.card, myClientId)}
                            myClientId={myClientId}
                            phase={phase}
                            showVotes={false}
                            voteCount={0}
                            staggerIndex={itemIndex + innerIndex}
                            voteSlot={undefined}
                            onDeleteCard={onDeleteCard}
                            onEditCard={onEditCard}
                          />
                        </Fragment>
                      ))}
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
              targetGroupId: undefined,
            }}
            disabled={!dndEnabled}
          />
        </ul>

        {isBrainstorm && (
          <div className="border-t border-dashed border-landing-border-soft px-3.5 pt-3 pb-3">
            <AddCardForm
              columnId={column.id}
              onTypingChange={store.setTypingIn}
              onSubmit={handleAddCard}
            />
          </div>
        )}
      </CardFrame>
    </div>
  );
};

export const Column = memo(observer(ColumnComponent));
