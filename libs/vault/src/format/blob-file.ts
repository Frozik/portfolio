import { assert } from '@frozik/utils/assert/assert';
import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';
import { isNil } from 'lodash-es';

import type { TBytes } from '../crypto/bytes';
import { bytesEqual, concatBytes, utf8 } from '../crypto/bytes';
import { deriveAesKey, importHkdfKey } from '../crypto/hkdf';
import type { IStreamParams } from '../crypto/stream-cipher';
import { decryptStream, encryptStream } from '../crypto/stream-cipher';
import type { TAssetId } from '../model/ids';
import type { IRandom } from '../ports/random';
import { ByteReader } from './byte-reader';
import { ByteWriter } from './byte-writer';
import { DEFAULT_CHUNK_SIZE } from './header';

const MAGIC = utf8('PWBLOB\0\0');
const FORMAT = 1;
const HEADER_BYTES = MAGIC.length + 2 + 4 + 8;
/** 32 random bytes per file, kept in `assets.json` inside the sealed container. */
/** A blob lives at `blobs/<assetId>.pwb`: beside the vault file, and inside a copy's archive. */
export const BLOB_FOLDER = 'blobs';
export const BLOB_EXTENSION = '.pwb';

export function blobFileName(assetId: string): string {
  return `${BLOB_FOLDER}/${assetId}${BLOB_EXTENSION}`;
}

export const BLOB_KEY_BYTES = 32;

export type TBlobError = 'corrupted' | 'unsupported-format';

export function newBlobKey(random: IRandom): TBytes {
  return random.bytes(BLOB_KEY_BYTES);
}

/** The header's SHA-256 and the asset id: a blob moved under another asset's name no longer opens. */
async function streamParams(
  blobKey: TBytes,
  assetId: TAssetId,
  header: TBytes
): Promise<IStreamParams> {
  return {
    key: await deriveAesKey(await importHkdfKey(blobKey), 'pwv/blob'),
    chunkSize: DEFAULT_CHUNK_SIZE,
    additionalData: concatBytes(
      new Uint8Array(await crypto.subtle.digest('SHA-256', header)),
      utf8(assetId)
    ),
  };
}

/**
 * `blobs/<assetId>.pwb`: a file too big to ride in the
 * container, sealed on its own under its own key in the same STREAM as the
 * vault: `MAGIC | FORMAT u16 | CHUNK_SIZE u32 | PLAIN_LEN u64 | chunks`.
 */
export async function sealBlob(
  blobKey: TBytes,
  assetId: TAssetId,
  content: TBytes
): Promise<TBytes> {
  assert(
    content.length > 0,
    'an external blob holds a file too big for the container, never an empty one'
  );
  const header = new ByteWriter()
    .bytes(MAGIC)
    .u16(FORMAT)
    .u32(DEFAULT_CHUNK_SIZE)
    .u64(content.length)
    .toBytes();
  const sealed = await encryptStream(await streamParams(blobKey, assetId, header), content);
  return concatBytes(header, sealed);
}

export async function openBlob(
  blobKey: TBytes,
  assetId: TAssetId,
  file: TBytes
): Promise<TResult<TBytes, TBlobError>> {
  const reader = new ByteReader(file);
  if (!reader.has(HEADER_BYTES) || !bytesEqual(reader.take(MAGIC.length), MAGIC)) {
    return err('unsupported-format');
  }
  if (reader.u16() !== FORMAT || reader.u32() !== DEFAULT_CHUNK_SIZE) {
    return err('unsupported-format');
  }
  const length = reader.u64();
  if (isNil(length)) {
    return err('corrupted');
  }
  const opened = await decryptStream(
    await streamParams(blobKey, assetId, file.slice(0, HEADER_BYTES)),
    file.slice(HEADER_BYTES)
  );
  if (!opened.ok) {
    return opened;
  }
  return opened.value.length === length ? ok(opened.value) : err('corrupted');
}
