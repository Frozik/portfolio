import { isNil } from 'lodash-es';

import type { ICardState } from './card';
import type { IHlc } from './hlc';
import type { TCardId } from './ids';
import { purgeCard } from './purge-card';
import type { IVaultDocument } from './vault-document';

/** How long a card stays in the trash before any device that notices deletes it for good. */
export const TRASH_RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Epoch milliseconds when a trashed card is deleted for good; `null` for a card not in the trash. */
export function purgeDueAt(card: ICardState): number | null {
  return isNil(card.trashedAt) ? null : card.trashedAt.wallMs + TRASH_RETENTION_DAYS * DAY_MS;
}

/** Every card past its term goes, each under a tombstone so other devices follow. */
export function expireTrash(document: IVaultDocument, nowMs: number, at: IHlc): IVaultDocument {
  const due: TCardId[] = [];
  for (const card of document.cards.values()) {
    const dueAt = purgeDueAt(card);
    if (!isNil(dueAt) && dueAt <= nowMs) {
      due.push(card.id);
    }
  }
  return due.reduce((current, cardId) => purgeCard(current, cardId, at), document);
}
