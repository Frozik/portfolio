import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useFunction } from '@frozik/components';
import { observer } from 'mobx-react-lite';
import { Fragment, memo, useMemo } from 'react';

import { cn } from '../../../../shared/lib/cn';
import { CardFrame, MonoKicker } from '../../../../shared/ui';
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

const COLUMN_NUMBER_PAD_LENGTH = 2;
const COLUMN_NUMBER_PAD_CHAR = '0';
const COLUMN_CODE_BASE_CHAR_CODE = 'A'.charCodeAt(0);

function formatColumnNumber(columnIndex: number): string {
  return String(columnIndex + 1).padStart(COLUMN_NUMBER_PAD_LENGTH, COLUMN_NUMBER_PAD_CHAR);
}

function formatColumnCode(columnIndex: number): string {
  return String.fromCharCode(COLUMN_CODE_BASE_CHAR_CODE + columnIndex);
}

interface ColumnCardItemProps {
  card: IRetroCard;
  cardIndex: number;
  columnAccentColor: string;
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
  cardIndex,
  columnAccentColor,
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
        <div className="pointer-events-none absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-landing-accent" />
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
  columnIndex: number;
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
  columnIndex,
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

  const totalVotes = useMemo(() => {
    let sum = 0;
    cards.forEach(card => {
      sum += countTotalVotesOnTarget(votesByTarget, card.id);
      if (card.groupId !== null) {
        sum += countTotalVotesOnTarget(votesByTarget, card.groupId);
      }
    });
    return sum;
  }, [cards, votesByTarget]);

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

  const columnNumber = formatColumnNumber(columnIndex);
  const columnCode = formatColumnCode(columnIndex);

  return (
    <div ref={setNodeRef}>
      <CardFrame
        className={cn(
          'flex h-full min-h-[520px] flex-col bg-landing-bg-elev/35 transition-colors',
          isOver && 'border-landing-accent/30 bg-landing-bg-elev/60'
        )}
      >
        <div className="row-divider flex items-start justify-between gap-3 px-4 py-3.5">
          <div className="flex flex-col gap-1.5">
            <MonoKicker tone="faint" className="tracking-[0.12em]">
              {columnNumber} / {t.room.columnKicker} {columnCode}
            </MonoKicker>
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                // Accent dot is the per-column color from the template — runtime
                // dynamic, so an inline style is idiomatic here.
                style={{ backgroundColor: column.color, boxShadow: `0 0 10px ${column.color}` }}
              />
              <h3 className="m-0 text-[15px] font-medium text-landing-fg">{column.title}</h3>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <MonoKicker tone="faint">{t.room.cardsVotesKicker}</MonoKicker>
            <div className="flex items-baseline gap-1 font-mono text-[15px] text-landing-fg">
              <span>{cards.length}</span>
              <span className="text-landing-fg-faint">·</span>
              <span>{totalVotes}</span>
            </div>
          </div>
        </div>

        {typingOthers.length > 0 && (
          <div className="row-divider px-4 py-2">
            <MonoKicker tone="faint" className="italic">
              {typingOthers.length === 1
                ? t.room.someoneIsWriting
                : `${typingOthers.length} ${t.room.multipleWriting}`}
            </MonoKicker>
          </div>
        )}

        <ul className="flex flex-1 flex-col p-3.5">
          {cards.length === 0 && (
            <li>
              <div className="border border-dashed border-landing-border-soft px-2.5 py-10 text-center">
                <MonoKicker tone="faint">{t.room.noCardsYet}</MonoKicker>
              </div>
            </li>
          )}
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
                      cardIndex={item.columnIndex}
                      columnAccentColor={column.color}
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
                  <div className="flex flex-col gap-2 border border-landing-accent/40 bg-landing-bg-elev/60 p-2">
                    <div className="flex items-center justify-between gap-2 px-1">
                      <MonoKicker tone="dim">
                        {t.room.groupLabel} · {item.cards.length}
                      </MonoKicker>
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
                              cardIndex={entry.columnIndex}
                              columnAccentColor={column.color}
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

        {isBrainstorm && (
          <div className="border-t border-dashed border-landing-border-soft px-3.5 pt-3 pb-3">
            <AddCardForm columnId={column.id} store={store} onSubmit={handleAddCard} />
          </div>
        )}
      </CardFrame>
    </div>
  );
};

export const Column = memo(observer(ColumnComponent));

export type { ColumnProps, IGapDropData };
