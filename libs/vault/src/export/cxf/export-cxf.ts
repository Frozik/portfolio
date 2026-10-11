import { isNil } from 'lodash-es';

import type { TBytes } from '../../crypto/bytes';
import { toBase64Url, utf8 } from '../../crypto/bytes';
import type { IContainerEntry } from '../../format/container';
import { packContainer } from '../../format/container';
import { appearanceExtension } from '../../format/cxf-appearance';
import { CXF_DOCUMENTS, CXF_PATH } from '../../format/export-archives';
import type { IVaultCard } from '../../model/card';
import type { TAssetId, TCardId } from '../../model/ids';
import { isLinkAlive } from '../../model/link-edits';
import type { IVaultDocument } from '../../model/vault-document';
import type { TCxfOutCredential } from './cxf-credentials';
import { credentialsOfCard } from './cxf-credentials';

const MS_PER_SECOND = 1000;
const CXF_VERSION = { major: 1, minor: 0 } as const;

export interface ICxfExporter {
  /** The relying party id of the exporting app: the host the vault runs on. */
  readonly rpId: string;
  readonly displayName: string;
  /** The vault's own id, the one account the file holds. */
  readonly accountId: string;
}

/** CXF ids are base64url of at most 64 bytes; ours are short ASCII, written as their bytes. */
function cxfId(id: string): string {
  return toBase64Url(utf8(id));
}

function seconds(ms: number): number {
  return Math.floor(ms / MS_PER_SECOND);
}

/** Links to cards the file carries and that are still linked: a reference never points out of the export. */
function linkedTo(
  document: IVaultDocument,
  exported: ReadonlySet<TCardId>,
  card: IVaultCard
): readonly TCxfOutCredential[] {
  return [...document.links.values()].flatMap(link => {
    const other = link.a === card.id ? link.b : link.b === card.id ? link.a : null;
    return isNil(other) || !exported.has(other) || !isLinkAlive(document, link)
      ? []
      : [{ type: 'item-reference', reference: { item: cxfId(other) } }];
  });
}

interface IExportFile {
  readonly bytes: TBytes;
  /** SHA-256 of the bytes written, not the stored one: what the reader checks is what it gets. */
  readonly sha256: TBytes;
}

async function filesOf(
  fileBytes: ReadonlyMap<TAssetId, TBytes>
): Promise<ReadonlyMap<TAssetId, IExportFile>> {
  return new Map(
    await Promise.all(
      [...fileBytes].map(async ([id, bytes]): Promise<readonly [TAssetId, IExportFile]> => [
        id,
        { bytes, sha256: new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)) },
      ])
    )
  );
}

function fileCredentials(
  document: IVaultDocument,
  files: ReadonlyMap<TAssetId, IExportFile>,
  fileIds: readonly TAssetId[]
): readonly TCxfOutCredential[] {
  return fileIds.flatMap(id => {
    const asset = document.assets.get(id);
    const file = files.get(id);
    return isNil(asset) || isNil(file)
      ? []
      : [
          {
            type: 'file',
            id: cxfId(id),
            name: asset.name,
            decryptedSize: file.bytes.byteLength,
            integrityHash: toBase64Url(file.sha256),
          },
        ];
  });
}

function itemOf(
  document: IVaultDocument,
  files: ReadonlyMap<TAssetId, IExportFile>,
  exported: ReadonlySet<TCardId>,
  rpId: string,
  card: IVaultCard
) {
  const { urls, credentials, fileIds } = credentialsOfCard(card);
  const appearance = appearanceExtension(rpId, card);
  return {
    id: cxfId(card.id),
    creationAt: seconds(card.createdAt.wallMs),
    modifiedAt: seconds(card.updatedAt.wallMs),
    title: card.title,
    favorite: card.favorite,
    ...(urls.length === 0 ? {} : { scope: { urls, androidApps: [] } }),
    ...(isNil(appearance) ? {} : { extensions: [appearance] }),
    credentials: [
      ...credentials,
      ...fileCredentials(document, files, fileIds),
      ...linkedTo(document, exported, card),
    ],
  };
}

/**
 * The vault in the Credential Exchange Format 1.0, for
 * other password managers: one account, its groups as collections, cards
 * (not those in the trash) as items. CXF names no container for a file, so
 * this is a zip: `cxf.json`, and each file under `documents/<its CXF id>`.
 */
export async function exportCxf(
  document: IVaultDocument,
  fileBytes: ReadonlyMap<TAssetId, TBytes>,
  exporter: ICxfExporter,
  nowMs: number
): Promise<TBytes> {
  const files = await filesOf(fileBytes);
  const cards = [...document.cards.values()].filter(card => isNil(card.trashedAt));
  const exported = new Set(cards.map(card => card.id));
  const items = cards.map(card => itemOf(document, files, exported, exporter.rpId, card));
  const collections = [...document.groups.values()].map(group => ({
    id: cxfId(group.id),
    title: group.name,
    items: cards
      .filter(card => card.groupIds.includes(group.id))
      .map(card => ({ item: cxfId(card.id) })),
  }));
  const header = {
    version: CXF_VERSION,
    exporterRpId: exporter.rpId,
    exporterDisplayName: exporter.displayName,
    timestamp: seconds(nowMs),
    accounts: [
      {
        id: cxfId(exporter.accountId),
        username: '',
        email: '',
        collections,
        items,
      },
    ],
  };
  const documents: readonly IContainerEntry[] = cards.flatMap(card =>
    credentialsOfCard(card).fileIds.flatMap(id => {
      const file = files.get(id);
      return isNil(file)
        ? []
        : [{ path: `${CXF_DOCUMENTS}${cxfId(id)}`, bytes: file.bytes, compress: false }];
    })
  );
  return packContainer([
    { path: CXF_PATH, bytes: utf8(JSON.stringify(header)), compress: true },
    ...documents,
  ]);
}
