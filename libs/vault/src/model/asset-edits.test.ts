import { aCardWith, aDocument, aField, anHlc } from '../testing/builders';
import { createSeededRandom } from '../testing/seeded-random';
import type { INewAsset } from './asset-edits';
import {
  addAsset,
  ASSET_MAX_BYTES,
  assetRefusal,
  collectAssets,
  VAULT_ASSETS_MAX_BYTES,
} from './asset-edits';

const DAY_MS = 24 * 60 * 60 * 1000;

function aFile(size: number): INewAsset {
  return { name: 'scan.jpg', mime: 'image/jpeg', bytes: new Uint8Array(size), sha256: 'hash' };
}

describe('asset edits', () => {
  it('refuses a file over 1 MiB, and one that would take the vault past 5 MiB', () => {
    const random = createSeededRandom(1);
    let document = aDocument();
    for (let index = 0; index < VAULT_ASSETS_MAX_BYTES / ASSET_MAX_BYTES; index += 1) {
      document = addAsset(document, aFile(ASSET_MAX_BYTES), anHlc(1), random).document;
    }

    expect(assetRefusal(aDocument(), ASSET_MAX_BYTES + 1)).toBe('too-large');
    expect(assetRefusal(document, 1)).toBe('vault-full');
    expect(assetRefusal(aDocument(), ASSET_MAX_BYTES)).toBeNull();
  });

  it('keeps a referenced file, stamps an unreferenced one, and drops it thirty days later', () => {
    const random = createSeededRandom(2);
    const kept = addAsset(aDocument(), aFile(10), anHlc(1), random);
    const orphan = addAsset(kept.document, aFile(10), anHlc(1), random);
    const card = aCardWith([aField({ kind: 'file' }, [kept.assetId])]);
    const document = { ...orphan.document, cards: new Map([[card.id, card]]) };

    const stamped = collectAssets(document, DAY_MS, anHlc(DAY_MS));
    expect(stamped.assets.get(orphan.assetId)?.orphanedAt).toEqual(anHlc(DAY_MS));
    expect(stamped.assets.get(kept.assetId)?.orphanedAt).toBeNull();

    const later = collectAssets(stamped, 31 * DAY_MS, anHlc(31 * DAY_MS));
    expect(later.assets.has(orphan.assetId)).toBe(false);
    expect(later.assetBytes.has(orphan.assetId)).toBe(false);
    expect(later.assets.has(kept.assetId)).toBe(true);
  });

  it('keeps a file a version in history still shows', () => {
    const random = createSeededRandom(3);
    const added = addAsset(aDocument(), aFile(10), anHlc(1), random);
    const old = aCardWith([aField({ kind: 'file' }, [added.assetId])]);
    const card = { ...aCardWith([]), history: [{ at: anHlc(1), snapshot: old }] };
    const document = { ...added.document, cards: new Map([[card.id, card]]) };

    expect(collectAssets(document, 60 * DAY_MS, anHlc(60 * DAY_MS))).toBe(document);
  });

  it('keeps a file only a draft holds', () => {
    const random = createSeededRandom(4);
    const added = addAsset(aDocument(), aFile(10), anHlc(1), random);

    const collected = collectAssets(added.document, 60 * DAY_MS, anHlc(60 * DAY_MS), [
      added.assetId,
    ]);

    expect(collected).toBe(added.document);
  });
});
