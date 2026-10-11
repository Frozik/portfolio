import { toHex } from '../crypto/bytes';
import { fileAssetIdsOf } from '../model/asset-edits';
import type { TAssetId } from '../model/ids';
import type { IImportBatch, IImportedAsset, IImportedCard, TImportWarning } from './imported-card';

const SHA256_HEX = /^[0-9a-f]{64}$/;

function holds(card: IImportedCard, assetId: TAssetId): boolean {
  return card.tabs.some(tab => tab.fields.some(field => fileAssetIdsOf(field).includes(assetId)));
}

/**
 * A file's hash is computed from its bytes, never taken
 * from the source; one whose bytes disagree with the hash the source
 * declares (a damaged archive, a careless exporter) stays out and is reported.
 */
export async function verifiedFiles(batch: IImportBatch): Promise<IImportBatch> {
  const assets: IImportedAsset[] = [];
  const warnings: TImportWarning[] = [];
  for (const imported of batch.assets) {
    const sha256 = toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', imported.bytes)));
    const declared = imported.asset.sha256.toLowerCase();
    if (SHA256_HEX.test(declared) && declared !== sha256) {
      const card = batch.cards.find(candidate => holds(candidate, imported.asset.id));
      warnings.push({ kind: 'file-dropped', card: card?.title ?? '', name: imported.asset.name });
      continue;
    }
    assets.push({ ...imported, asset: { ...imported.asset, sha256 } });
  }
  return { ...batch, assets, warnings: [...batch.warnings, ...warnings] };
}
