import { isNil } from 'lodash-es';

import type { TBytes } from '../../crypto/bytes';
import type { IContainerEntry } from '../../format/container';
import { packContainer } from '../../format/container';
import { encodeDocument } from '../../format/document-codec';
import type { TManifest } from '../../format/manifest';
import { encodeManifest, MANIFEST_PATH } from '../../format/manifest';
import { fileAssetIdsOf } from '../../model/asset-edits';
import type { IVaultCard } from '../../model/card';
import { allFields } from '../../model/card';
import type { TAssetId } from '../../model/ids';
import type { IVaultDocument } from '../../model/vault-document';

const UNSAFE_NAME = /[/\\]|^\.+$/g;

function numbered(name: string, number: number): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? `${name.slice(0, dot)} (${number})${name.slice(dot)}` : `${name} (${number})`;
}

/**
 * A file's own name, made safe as one path segment and unique within its
 * card's folder — case-insensitively, as macOS and Windows unpack `A.txt`
 * and `a.txt` onto one file.
 */
function fileNames(names: readonly string[]): readonly string[] {
  const used = new Set<string>();
  return names.map(name => {
    const safe = name.replaceAll(UNSAFE_NAME, '_') || '_';
    let unique = safe;
    for (let number = 2; used.has(unique.toLowerCase()); number += 1) {
      unique = numbered(safe, number);
    }
    used.add(unique.toLowerCase());
    return unique;
  });
}

function cardFiles(
  document: IVaultDocument,
  fileBytes: ReadonlyMap<TAssetId, TBytes>,
  card: IVaultCard
): readonly IContainerEntry[] {
  const files = allFields(card)
    .flatMap(fileAssetIdsOf)
    .flatMap(id => {
      const asset = document.assets.get(id);
      const bytes = fileBytes.get(id);
      return isNil(asset) || isNil(bytes) ? [] : [{ name: asset.name, bytes }];
    });
  const names = fileNames(files.map(file => file.name));
  return files.map((file, index) => ({
    path: `cards/${card.id}/files/${names[index] ?? file.name}`,
    bytes: file.bytes,
    compress: false,
  }));
}

/**
 * The vault without its lock: the container as it is
 * (readable by any archiver), plus each card's files under
 * their own names in `cards/<id>/files/` — inline ones and blobs alike, read
 * by the caller.
 */
export function exportOpenZip(
  document: IVaultDocument,
  manifest: TManifest,
  fileBytes: ReadonlyMap<TAssetId, TBytes> = document.assetBytes
): TBytes {
  return packContainer([
    { path: MANIFEST_PATH, bytes: encodeManifest(manifest), compress: true },
    ...encodeDocument(document),
    ...[...document.cards.values()].flatMap(card => cardFiles(document, fileBytes, card)),
  ]);
}
