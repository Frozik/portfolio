import {
  ASSET_MAX_BYTES,
  BLOB_MAX_BYTES,
  VAULT_ASSETS_MAX_BYTES,
  vaultAssetsBytes,
} from '../model/asset-edits';
import type { TAssetId } from '../model/ids';
import type { IVaultDocument } from '../model/vault-document';
import type { IImportBatch, IImportedAsset } from './imported-card';

/** A file the import sealed beside the vault before the edit: the id it was sealed under and its key in hex. */
export interface IPlacedBlob {
  readonly id: TAssetId;
  readonly blobKey: string;
}

/**
 * The files of a batch that cannot ride in the
 * container: over the per-file limit, or past what the vault has left, in
 * the batch's order. The rest come in inline; any subset of them still fits,
 * whichever cards the duplicate choice keeps.
 */
export function blobsToPlace(
  document: IVaultDocument,
  batch: IImportBatch
): readonly IImportedAsset[] {
  let inline = vaultAssetsBytes(document);
  return batch.assets.filter(({ bytes }) => {
    const size = bytes.byteLength;
    if (size <= ASSET_MAX_BYTES && inline + size <= VAULT_ASSETS_MAX_BYTES) {
      inline += size;
      return false;
    }
    return size <= BLOB_MAX_BYTES;
  });
}
