import type {
  CardId,
  ClientId,
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

export interface ISnapshotSummary {
  totalCards: number;
  totalGroups: number;
  totalActionItems: number;
  totalVotesCast: number;
  participantCount: number;
}

/**
 * Compact numeric summary used by the Close-phase modal.
 */
export function summarizeSnapshot(snapshot: IRetroSnapshot): ISnapshotSummary {
  const participants = new Set<ClientId>();
  let totalVotesCast = 0;

  snapshot.cards.forEach(card => participants.add(card.authorClientId));

  snapshot.votes.forEach(votesForTarget => {
    votesForTarget.forEach((count, clientId) => {
      participants.add(clientId);
      totalVotesCast += count;
    });
  });

  return {
    totalCards: snapshot.cards.length,
    totalGroups: snapshot.groups.length,
    totalActionItems: snapshot.actionItems.length,
    totalVotesCast,
    participantCount: participants.size,
  };
}

/**
 * Resolve the group a card belongs to (if any). Helper used by both
 * markdown export and the Group-phase renderer.
 */
export function findGroupForCard(
  cardId: CardId,
  groups: readonly IRetroGroup[]
): IRetroGroup | undefined {
  return groups.find(group => group.cardIds.includes(cardId));
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
