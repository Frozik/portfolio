import { REDACTED_CARD_PLACEHOLDER } from './constants';
import type { ClientId, IRetroCard } from './types';
import { ERetroPhase } from './types';

/**
 * Returns true when the card text must be hidden from the viewer.
 *
 * Rules (per anti-anchoring design):
 *  - During Brainstorm: every card except viewer's own is redacted.
 *  - From Group phase onwards: all card text is revealed to everyone.
 */
export function shouldRedactCard(
  card: IRetroCard,
  phase: ERetroPhase,
  viewerClientId: ClientId
): boolean {
  if (phase !== ERetroPhase.Brainstorm) {
    return false;
  }

  return card.authorClientId !== viewerClientId;
}

/**
 * Returns either the actual text or the redacted placeholder based on
 * current phase and viewer identity.
 */
export function visibleCardText(
  card: IRetroCard,
  phase: ERetroPhase,
  viewerClientId: ClientId
): string {
  return shouldRedactCard(card, phase, viewerClientId) ? REDACTED_CARD_PLACEHOLDER : card.text;
}

/**
 * Returns true when the viewer is allowed to edit/delete the card.
 * We enforce permanent-anonymous-authorship at the UI level — a client
 * may only mutate cards they authored, regardless of phase.
 */
export function canMutateCard(card: IRetroCard, viewerClientId: ClientId): boolean {
  return card.authorClientId === viewerClientId;
}

/**
 * Count peers (excluding the viewer) currently typing in a given column.
 * Used for "N people are writing..." placeholder in Brainstorm.
 */
export function countPeersTypingInColumn<TColumnId>(
  participants: readonly { clientId: ClientId; typingInColumnId: TColumnId | null }[],
  columnId: TColumnId,
  viewerClientId: ClientId
): number {
  return participants.filter(
    participant =>
      participant.clientId !== viewerClientId && participant.typingInColumnId === columnId
  ).length;
}
