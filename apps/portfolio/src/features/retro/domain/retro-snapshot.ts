import type {
  CardId,
  GroupId,
  IActionItem,
  IColumnConfig,
  IRetroCard,
  IRetroGroup,
  IRetroMeta,
  IRetroSnapshot,
  VotesByTarget,
} from './types';

export interface ICreateSnapshotInput {
  meta: IRetroMeta;
  columns: readonly IColumnConfig[];
  cards: readonly IRetroCard[];
  groups: readonly IRetroGroup[];
  actionItems: readonly IActionItem[];
  votes: VotesByTarget;
}

/**
 * Build an immutable snapshot of a retro room. The snapshot is a plain
 * JS-value projection and safe to pass across the DDD boundary — no Yjs
 * references, no mutation.
 */
export function createRetroSnapshot(input: ICreateSnapshotInput): IRetroSnapshot {
  return {
    meta: input.meta,
    columns: input.columns,
    cards: input.cards,
    groups: input.groups,
    actionItems: input.actionItems,
    votes: input.votes,
  };
}

/**
 * Collect cards belonging to a specific column, preserving insertion order.
 */
export function getCardsInColumn(
  snapshot: IRetroSnapshot,
  columnId: IColumnConfig['id']
): IRetroCard[] {
  return snapshot.cards.filter(card => card.columnId === columnId);
}

/**
 * Enumerate every vote-target in a snapshot: group ids first, then
 * ungrouped card ids.
 */
export function enumerateVoteTargets(snapshot: IRetroSnapshot): (CardId | GroupId)[] {
  const groupedCardIds = new Set<CardId>();
  snapshot.groups.forEach(group => group.cardIds.forEach(cardId => groupedCardIds.add(cardId)));

  const groupIds: GroupId[] = snapshot.groups.map(group => group.id);
  const ungroupedCardIds: CardId[] = snapshot.cards
    .filter(card => !groupedCardIds.has(card.id))
    .map(card => card.id);

  return [...groupIds, ...ungroupedCardIds];
}
