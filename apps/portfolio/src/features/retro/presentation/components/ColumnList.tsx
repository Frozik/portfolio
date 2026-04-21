import type { DragEndEvent } from '@dnd-kit/core';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useFunction } from '@frozik/components';
import { observer } from 'mobx-react-lite';
import { useMemo } from 'react';

import type { RoomStore } from '../../application/RoomStore';
import type { CardId, ClientId, ColumnId, IRetroCard } from '../../domain/types';
import { ERetroPhase } from '../../domain/types';

import { Column } from './Column';

interface ColumnListProps {
  store: RoomStore;
}

const ColumnListComponent = ({ store }: ColumnListProps) => {
  const snapshot = store.currentSnapshot;

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const handleAddCard = useFunction((columnId: ColumnId, text: string) => {
    store.addCard(columnId, text);
  });

  const handleDeleteCard = useFunction((cardId: CardId) => {
    store.deleteCard(cardId);
  });

  const handleEditCard = useFunction((cardId: CardId, text: string) => {
    store.editCard(cardId, text);
  });

  const handleDragEnd = useFunction((event: DragEndEvent) => {
    const over = event.over;
    if (over === null) {
      return;
    }
    const cardId = event.active.id as CardId;
    if (over.id === cardId) {
      return;
    }
    const overType = (over.data.current as { type?: string } | undefined)?.type;
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

  if (snapshot === null) {
    return null;
  }

  const dndEnabled =
    snapshot.meta.phase === ERetroPhase.Group || snapshot.meta.phase === ERetroPhase.Brainstorm;

  return (
    <DndContext sensors={sensors} onDragEnd={dndEnabled ? handleDragEnd : undefined}>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {snapshot.columns.map(column => (
          <Column
            key={column.id}
            column={column}
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
    </DndContext>
  );
};

export const ColumnList = observer(ColumnListComponent);

export type { ColumnListProps };
