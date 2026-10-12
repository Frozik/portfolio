import { isEqual, isNil } from 'lodash-es';

import type { ICardState, IVaultCard } from './card';
import { trashCard } from './card-edits';
import type { IHlc } from './hlc';
import { boundedAncestors, cardState, commitCard } from './revision-edits';
import type { IVaultDocument } from './vault-document';

export interface IRollbackSummary {
  /** Cards that had changed since and got the backup's version back. */
  readonly restored: number;
  /** Cards deleted for good since, back again. */
  readonly revived: number;
  /** Cards made since, now in the trash. */
  readonly trashed: number;
}

/** The backup's version of a card, as an edit of the current one: same id and creation, the protection of now. */
function backupVersion(current: IVaultCard, backup: IVaultCard): ICardState {
  return {
    ...cardState(backup),
    id: current.id,
    createdAt: current.createdAt,
    protected: current.protected,
    updatedAt: current.updatedAt,
    ancestors: current.ancestors,
  };
}

/** Stamped now, so it outlives the tombstone its deletion left on every device. */
function revived(backup: IVaultCard, at: IHlc): IVaultCard {
  return {
    ...backup,
    updatedAt: at,
    ancestors: boundedAncestors([backup.updatedAt, ...backup.ancestors]),
  };
}

function withBackupAssets(document: IVaultDocument, backup: IVaultDocument): IVaultDocument {
  const missing = [...backup.assets.values()].filter(asset => !document.assets.has(asset.id));
  if (missing.length === 0) {
    return document;
  }
  const assets = new Map(document.assets);
  const assetBytes = new Map(document.assetBytes);
  for (const asset of missing) {
    assets.set(asset.id, asset);
    const bytes = backup.assetBytes.get(asset.id);
    if (!isNil(bytes)) {
      assetBytes.set(asset.id, bytes);
    }
  }
  return { ...document, assets, assetBytes };
}

/**
 * The vault as the backup had it, as one edit on top of now rather than a
 * replaced file: every device takes it with the next sync instead of merging
 * it away, each changed card keeps its current version in history, and the
 * cards made since go to the trash, where they can still be fetched back.
 */
export function rollbackTo(
  current: IVaultDocument,
  backup: IVaultDocument,
  at: IHlc
): { readonly document: IVaultDocument; readonly summary: IRollbackSummary } {
  const cards = new Map(current.cards);
  const summary = { restored: 0, revived: 0, trashed: 0 };
  for (const backupCard of backup.cards.values()) {
    const card = current.cards.get(backupCard.id);
    if (isNil(card)) {
      cards.set(backupCard.id, revived(backupCard, at));
      summary.revived += 1;
      continue;
    }
    const version = backupVersion(card, backupCard);
    if (!isEqual(cardState(card), version)) {
      cards.set(card.id, commitCard(card, version, at, { keepPrevious: true }));
      summary.restored += 1;
    }
  }
  for (const card of current.cards.values()) {
    if (!backup.cards.has(card.id) && isNil(card.trashedAt)) {
      cards.set(card.id, commitCard(card, trashCard(cardState(card), at), at));
      summary.trashed += 1;
    }
  }
  const changed = summary.restored + summary.revived + summary.trashed > 0;
  const document = withBackupAssets(changed ? { ...current, cards } : current, backup);
  return { document, summary };
}
