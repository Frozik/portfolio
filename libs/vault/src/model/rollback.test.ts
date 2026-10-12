import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';

import { mergeDocument } from '../merge/merge-document';
import { aCard, aDocument, anHlc } from '../testing/builders';
import { renameCard } from './card-edits';
import type { TAssetId } from './ids';
import { purgeCard } from './purge-card';
import { commitCard } from './revision-edits';
import { rollbackTo } from './rollback';

const THEN = anHlc(10);
const NOW = anHlc(100);
const ROLLBACK = anHlc(200);

function renamed(card: ReturnType<typeof aCard>, title: string, at = NOW) {
  return commitCard(card, renameCard(card, title), at);
}

describe('rollbackTo', () => {
  it('brings a changed card back as a new version, the current one kept in its history', () => {
    const card = aCard({ title: 'Bank', updatedAt: THEN });
    const backup = aDocument([card]);
    const current = aDocument([renamed(card, 'Bank (new)')]);

    const { document, summary } = rollbackTo(current, backup, ROLLBACK);
    const restored = document.cards.get(card.id);
    assert(!isNil(restored));

    expect(restored.title).toBe('Bank');
    expect(restored.updatedAt).toEqual(ROLLBACK);
    expect(restored.history.map(revision => revision.snapshot.title)).toContain('Bank (new)');
    expect(summary).toEqual({ restored: 1, revived: 0, trashed: 0 });
  });

  it('wins over the other devices: a merge with the version before keeps the rollback', () => {
    const card = aCard({ title: 'Bank', updatedAt: THEN });
    const current = aDocument([renamed(card, 'Bank (new)')]);

    const { document } = rollbackTo(current, aDocument([card]), ROLLBACK);

    expect(mergeDocument(current, document).cards.get(card.id)?.title).toBe('Bank');
  });

  it('puts the cards made since into the trash, not out of the vault', () => {
    const kept = aCard({ title: 'Kept' });
    const newer = aCard({ title: 'Made later', updatedAt: NOW });

    const { document, summary } = rollbackTo(aDocument([kept, newer]), aDocument([kept]), ROLLBACK);

    expect(document.cards.get(newer.id)?.trashedAt).toEqual(ROLLBACK);
    expect(document.cards.get(kept.id)).toBe(kept);
    expect(summary).toEqual({ restored: 0, revived: 0, trashed: 1 });
  });

  it('brings back a card deleted for good since, and the merge does not delete it again', () => {
    const card = aCard({ title: 'Gone' });
    const current = purgeCard(aDocument([card]), card.id, NOW);

    const { document, summary } = rollbackTo(current, aDocument([card]), ROLLBACK);

    expect(document.cards.get(card.id)?.title).toBe('Gone');
    expect(mergeDocument(current, document).cards.has(card.id)).toBe(true);
    expect(summary).toEqual({ restored: 0, revived: 1, trashed: 0 });
  });

  it('keeps the protection a card has now, whatever the backup says', () => {
    const card = aCard({ title: 'Bank', protected: false, updatedAt: THEN });
    const now = commitCard(card, { ...renameCard(card, 'Bank 2'), protected: true }, NOW);

    const { document } = rollbackTo(aDocument([now]), aDocument([card]), ROLLBACK);

    expect(document.cards.get(card.id)?.protected).toBe(true);
  });

  it('brings back a file the backup’s cards still use', () => {
    const assetId = 'asset-1' as TAssetId;
    const bytes = Uint8Array.of(1, 2, 3);
    const backup = aDocument([], {
      assets: new Map([
        [
          assetId,
          {
            id: assetId,
            name: 'scan.png',
            mime: 'image/png',
            sha256: 'x',
            storage: { kind: 'inline' },
            orphanedAt: null,
            createdAt: THEN,
          },
        ],
      ]),
      assetBytes: new Map([[assetId, bytes]]),
    });

    const { document } = rollbackTo(aDocument(), backup, ROLLBACK);

    expect(document.assetBytes.get(assetId)).toEqual(bytes);
    expect(document.assets.has(assetId)).toBe(true);
  });

  it('changes nothing when the vault is as the backup was', () => {
    const document = aDocument([aCard()]);

    const rolledBack = rollbackTo(document, document, ROLLBACK);

    expect(rolledBack.document).toBe(document);
    expect(rolledBack.summary).toEqual({ restored: 0, revived: 0, trashed: 0 });
  });
});
