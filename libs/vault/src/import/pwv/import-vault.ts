import { isNil } from 'lodash-es';

import type { TBytes } from '../../crypto/bytes';
import { fromHexBytes } from '../../crypto/bytes';
import { openBlob } from '../../format/blob-file';
import { fileAssetIdsOf } from '../../model/asset-edits';
import type { ICardTab, IVaultCard } from '../../model/card';
import { allFields } from '../../model/card';
import { hotpCounterKey } from '../../model/hotp-counters';
import type { TAssetId } from '../../model/ids';
import { isLinkAlive } from '../../model/link-edits';
import type { IAsset, IVaultDocument } from '../../model/vault-document';
import type {
  IImportBatch,
  IImportedAsset,
  IImportedCard,
  IImportedTab,
  TImportWarning,
} from '../imported-card';
import { textLabel } from '../imported-card';

function importedTab(document: IVaultDocument, card: IVaultCard, tab: ICardTab): IImportedTab {
  return {
    title: isNil(tab.title) ? null : textLabel(tab.title),
    fields: tab.fields.map(field => ({
      label: textLabel(field.label),
      spec: field.spec,
      value: field.value,
      sensitive: field.sensitive,
      hotpCounter: document.hotpCounters.get(hotpCounterKey(card.id, field.id)) ?? null,
    })),
  };
}

function importedCard(document: IVaultDocument, card: IVaultCard): IImportedCard {
  const toTab = (tab: ICardTab): IImportedTab => importedTab(document, card, tab);
  const [firstTab, ...otherTabs] = card.tabs;
  return {
    templateId: card.templateId,
    title: card.title,
    tabs: [toTab(firstTab), ...otherTabs.map(toTab)],
    groups: card.groupIds.flatMap(id => {
      const group = document.groups.get(id);
      return isNil(group) ? [] : [group.name];
    }),
    favorite: card.favorite,
    protected: card.protected,
    archived: !isNil(card.archivedAt),
    color: card.color,
    icon: card.icon,
    createdAtMs: card.createdAt.wallMs,
  };
}

function assetIdsOf(card: IVaultCard): readonly TAssetId[] {
  const fromFields = allFields(card).flatMap(fileAssetIdsOf);
  return card.icon.kind === 'custom' ? [...fromFields, card.icon.assetId] : fromFields;
}

/** A file of the vault as bytes: inline ones as they are, a blob opened with the key the vault keeps. */
async function bytesOf(
  document: IVaultDocument,
  asset: IAsset,
  sealedBlobs: ReadonlyMap<string, TBytes>
): Promise<TBytes | null> {
  if (asset.storage.kind === 'inline') {
    return document.assetBytes.get(asset.id) ?? null;
  }
  const sealed = sealedBlobs.get(asset.id);
  const blobKey = fromHexBytes(asset.storage.key);
  if (isNil(sealed) || isNil(blobKey)) {
    return null;
  }
  const opened = await openBlob(blobKey, asset.id, sealed);
  return opened.ok ? opened.value : null;
}

/**
 * Another `.pwv`, already opened with its own password: its
 * cards outside the trash, with their links, files and HOTP counters, come in
 * as new cards; a copy's big files come from beside it. An
 * import, not a sync: nothing ties the two vaults afterwards.
 */
export async function importVaultDocument(
  document: IVaultDocument,
  sealedBlobs: ReadonlyMap<string, TBytes> = new Map()
): Promise<IImportBatch> {
  const cards = [...document.cards.values()].filter(card => isNil(card.trashedAt));
  const position = new Map(cards.map((card, index) => [card.id, index]));
  const links = [...document.links.values()].flatMap(link => {
    const a = position.get(link.a);
    const b = position.get(link.b);
    return isNil(a) || isNil(b) || !isLinkAlive(document, link) ? [] : [[a, b] as const];
  });
  const assets: IImportedAsset[] = [];
  const warnings: TImportWarning[] = [];
  const seen = new Set<TAssetId>();
  for (const card of cards) {
    for (const id of assetIdsOf(card)) {
      const asset = document.assets.get(id);
      if (isNil(asset) || seen.has(id)) {
        continue;
      }
      seen.add(id);
      const bytes = await bytesOf(document, asset, sealedBlobs);
      if (isNil(bytes)) {
        warnings.push({ kind: 'file-dropped', card: card.title, name: asset.name });
      } else {
        assets.push({ asset, bytes });
      }
    }
  }
  return {
    source: 'pwv',
    cards: cards.map(card => importedCard(document, card)),
    links,
    assets,
    warnings,
  };
}
