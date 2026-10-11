import { isNil } from 'lodash-es';

import type { IRandom } from '../ports/random';
import type { ICardField, ICardState, IVaultCard } from './card';
import { allFields } from './card';
import type { IHlc } from './hlc';
import type { TAssetId } from './ids';
import { newAssetId } from './ids';
import type { IVaultDocument } from './vault-document';

const MIB = 1024 * 1024;
/** Inline files ride in the container, which every save re-encrypts and uploads whole. */
export const ASSET_MAX_BYTES = MIB;
export const VAULT_ASSETS_MAX_BYTES = 5 * MIB;
/** An unreferenced file goes this long after it was last seen orphaned. */
export const ORPHAN_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export type TAssetRefusal = 'too-large' | 'vault-full';

export interface INewAsset {
  readonly name: string;
  readonly mime: string;
  readonly bytes: Uint8Array<ArrayBuffer>;
  /** SHA-256 of the bytes, hex: integrity only, never a name. */
  readonly sha256: string;
}

export function vaultAssetsBytes(document: IVaultDocument): number {
  return [...document.assetBytes.values()].reduce((total, bytes) => total + bytes.byteLength, 0);
}

/** What keeps a file out: too big alone, or no room left in the vault. */
export function assetRefusal(document: IVaultDocument, size: number): TAssetRefusal | null {
  if (size > ASSET_MAX_BYTES) {
    return 'too-large';
  }
  return vaultAssetsBytes(document) + size > VAULT_ASSETS_MAX_BYTES ? 'vault-full' : null;
}

/** A file too big for the container is sealed on its own, up to this. */
export const BLOB_MAX_BYTES = 50 * MIB;

/** Where a new file goes: inside the container, beside it, or nowhere. */
export type TAssetPlacement = 'inline' | 'blob' | 'too-large';

export function assetPlacement(document: IVaultDocument, size: number): TAssetPlacement {
  if (isNil(assetRefusal(document, size))) {
    return 'inline';
  }
  return size <= BLOB_MAX_BYTES ? 'blob' : 'too-large';
}

/** A file sealed beside the vault: its key rides in the container, its bytes in `blobs/<id>.pwb`. */
export function addBlobAsset(
  document: IVaultDocument,
  asset: Omit<INewAsset, 'bytes'> & { readonly id: TAssetId; readonly blobKey: string },
  at: IHlc
): IVaultDocument {
  return {
    ...document,
    assets: new Map(document.assets).set(asset.id, {
      id: asset.id,
      name: asset.name,
      mime: asset.mime,
      sha256: asset.sha256,
      storage: { kind: 'blob', key: asset.blobKey },
      orphanedAt: null,
      createdAt: at,
    }),
  };
}

/** A new immutable file; the field that shows it stores the returned id. */
export function addAsset(
  document: IVaultDocument,
  asset: INewAsset,
  at: IHlc,
  random: IRandom
): { readonly document: IVaultDocument; readonly assetId: TAssetId } {
  const id = newAssetId(random);
  return {
    assetId: id,
    document: {
      ...document,
      assets: new Map(document.assets).set(id, {
        id,
        name: asset.name,
        mime: asset.mime,
        sha256: asset.sha256,
        storage: { kind: 'inline' },
        orphanedAt: null,
        createdAt: at,
      }),
      assetBytes: new Map(document.assetBytes).set(id, asset.bytes),
    },
  };
}

/** A file field stores asset ids; an empty single value is no file. */
export function fileAssetIdsOf(field: Pick<ICardField, 'spec' | 'value'>): readonly TAssetId[] {
  if (field.spec.kind !== 'file') {
    return [];
  }
  const values = field.value.cardinality === 'single' ? [field.value.value] : field.value.values;
  return values.filter(value => value !== '').map(value => value as TAssetId);
}

function referencesOf(card: ICardState): readonly string[] {
  const fromFields = allFields(card).flatMap(fileAssetIdsOf);
  return card.icon.kind === 'custom' ? [...fromFields, card.icon.assetId] : fromFields;
}

/** A file is referenced by a field, a custom icon, a version in history or a card in the trash. */
function referencedAssets(cards: Iterable<IVaultCard>): ReadonlySet<string> {
  const referenced = new Set<string>();
  for (const card of cards) {
    for (const state of [card, ...card.history.map(revision => revision.snapshot)]) {
      referencesOf(state).forEach(id => referenced.add(id));
    }
  }
  return referenced;
}

/**
 * Housekeeping: a file nothing refers to is stamped orphaned
 * (once; a merge keeps the later stamp), and one orphaned for 30 days goes.
 * References are counted again before removal, so a file mentioned anew stays.
 */
export function collectAssets(
  document: IVaultDocument,
  nowMs: number,
  at: IHlc,
  /** Files a draft holds that the document does not know yet: they are references too. */
  heldElsewhere: readonly TAssetId[] = []
): IVaultDocument {
  const referenced = new Set([...referencedAssets(document.cards.values()), ...heldElsewhere]);
  let changed = false;
  const assets = new Map(document.assets);
  const assetBytes = new Map(document.assetBytes);
  for (const asset of document.assets.values()) {
    if (referenced.has(asset.id)) {
      continue;
    }
    if (isNil(asset.orphanedAt)) {
      assets.set(asset.id, { ...asset, orphanedAt: at });
      changed = true;
    } else if (nowMs - asset.orphanedAt.wallMs >= ORPHAN_RETENTION_MS) {
      assets.delete(asset.id);
      assetBytes.delete(asset.id);
      changed = true;
    }
  }
  return changed ? { ...document, assets, assetBytes } : document;
}
