import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useFunction } from '@frozik/components';
import { observer } from 'mobx-react-lite';
import { useMemo, useState } from 'react';

import type { RoomStore } from '../../application/RoomStore';
import type { CardId, ClientId, ColumnId, IRetroCard } from '../../domain/types';
import { ERetroPhase } from '../../domain/types';

import { CardDragPreview } from './CardDragPreview';
import type { IGapDropData } from './Column';
import { Column } from './Column';

interface ColumnListProps {
  store: RoomStore;
}

const ColumnListComponent = ({ store }: ColumnListProps) => {
  const snapshot = store.currentSnapshot;

  // Separate sensors per input type so mobile long-press can coexist with
  // page scroll and native text-selection, while desktop keeps the quick
  // 4px activation.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  );

  const [activeCardId, setActiveCardId] = useState<CardId | null>(null);

  const handleAddCard = useFunction((columnId: ColumnId, text: string) => {
    store.addCard(columnId, text);
  });

  const handleDeleteCard = useFunction((cardId: CardId) => {
    store.deleteCard(cardId);
  });

  const handleEditCard = useFunction((cardId: CardId, text: string) => {
    store.editCard(cardId, text);
  });

  const handleDragStart = useFunction((event: DragStartEvent) => {
    setActiveCardId(event.active.id as CardId);
  });

  const handleDragCancel = useFunction(() => {
    setActiveCardId(null);
  });

  const handleDragEnd = useFunction((event: DragEndEvent) => {
    setActiveCardId(null);
    const over = event.over;
    if (over === null) {
      return;
    }
    const cardId = event.active.id as CardId;
    if (over.id === cardId) {
      return;
    }
    const overData = over.data.current as
      | { type?: 'card' | 'column' | 'gap' }
      | IGapDropData
      | undefined;
    const overType = overData?.type;

    if (overType === 'gap') {
      const gapData = overData as IGapDropData;
      store.moveCardToPosition(
        cardId,
        gapData.targetColumnId,
        gapData.targetIndex,
        gapData.targetGroupId
      );
      return;
    }

    if (overType === 'card') {
      store.groupCards(cardId, over.id as CardId);
      return;
    }

    const targetColumnId = String(over.id) as ColumnId;
    store.moveCardToColumn(cardId, targetColumnId, Number.MAX_SAFE_INTEGER);
  });

  const cardsByColumn = useMemo(() => {
    const grouped = new Map<ColumnId, IRetroCard[]>();
    if (snapshot === null) {
      return grouped;
    }
    snapshot.cards.forEach(card => {
      const list = grouped.get(card.columnId);
      if (list === undefined) {
        grouped.set(card.columnId, [card]);
      } else {
        list.push(card);
      }
    });
    return grouped;
  }, [snapshot]);

  const activeCard = useMemo(
    () =>
      activeCardId === null
        ? null
        : (snapshot?.cards.find(candidate => candidate.id === activeCardId) ?? null),
    [activeCardId, snapshot]
  );

  if (snapshot === null) {
    return null;
  }

  const dndEnabled =
    snapshot.meta.phase === ERetroPhase.Group || snapshot.meta.phase === ERetroPhase.Brainstorm;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={dndEnabled ? handleDragStart : undefined}
      onDragEnd={dndEnabled ? handleDragEnd : undefined}
      onDragCancel={dndEnabled ? handleDragCancel : undefined}
    >
      <div className="grid grid-cols-1 gap-[18px] md:grid-cols-3">
        {snapshot.columns.map((column, columnIndex) => (
          <Column
            key={column.id}
            column={column}
            columnIndex={columnIndex}
            cards={cardsByColumn.get(column.id) ?? []}
            phase={snapshot.meta.phase}
            myClientId={store.identity.clientId as ClientId}
            votesByTarget={snapshot.votes}
            store={store}
            onAddCard={handleAddCard}
            onDeleteCard={handleDeleteCard}
            onEditCard={handleEditCard}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeCard === null ? null : <CardDragPreview card={activeCard} />}
      </DragOverlay>
    </DndContext>
  );
};

export const ColumnList = observer(ColumnListComponent);

export type { ColumnListProps };
