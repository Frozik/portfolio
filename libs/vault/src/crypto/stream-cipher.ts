import { assert } from '@frozik/utils/assert/assert';
import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';

import { NONCE_BYTES, openBlock, sealBlock, TAG_BYTES } from './aead';
import type { TBytes } from './bytes';
import { concatBytes } from './bytes';

const LAST_FLAG_OFFSET = NONCE_BYTES - 1;
const COUNTER_END = LAST_FLAG_OFFSET;
const COUNTER_TAIL_BYTES = 4;
const LAST_CHUNK = 1;

export interface IStreamParams {
  readonly key: CryptoKey;
  readonly chunkSize: number;
  readonly additionalData: TBytes;
}

/**
 * The age STREAM nonce: an 11-byte big-endian chunk counter
 * and a final byte that is 1 only on the last chunk, so dropping or adding
 * chunks at the end breaks authentication instead of yielding a shorter text.
 */
function chunkNonce(index: number, isLast: boolean): TBytes {
  const nonce = new Uint8Array(NONCE_BYTES);
  new DataView(nonce.buffer).setUint32(COUNTER_END - COUNTER_TAIL_BYTES, index);
  nonce[LAST_FLAG_OFFSET] = isLast ? LAST_CHUNK : 0;
  return nonce;
}

function chunkCount(length: number, size: number): number {
  return Math.max(1, Math.ceil(length / size));
}

export async function encryptStream(
  { key, chunkSize, additionalData }: IStreamParams,
  plaintext: TBytes
): Promise<TBytes> {
  assert(plaintext.length > 0, 'STREAM never seals an empty text: the padding guarantees a byte');
  const count = chunkCount(plaintext.length, chunkSize);
  const sealed = await Promise.all(
    Array.from({ length: count }, (_, index) =>
      sealBlock(
        key,
        chunkNonce(index, index === count - 1),
        plaintext.slice(index * chunkSize, (index + 1) * chunkSize),
        additionalData
      )
    )
  );
  return concatBytes(...sealed);
}

export async function decryptStream(
  { key, chunkSize, additionalData }: IStreamParams,
  ciphertext: TBytes
): Promise<TResult<TBytes, 'corrupted'>> {
  const sealedChunkSize = chunkSize + TAG_BYTES;
  const count = chunkCount(ciphertext.length, sealedChunkSize);
  const lastSealedLength = ciphertext.length - (count - 1) * sealedChunkSize;
  if (lastSealedLength <= TAG_BYTES) {
    return err('corrupted');
  }
  const opened = await Promise.all(
    Array.from({ length: count }, (_, index) =>
      openBlock(
        key,
        chunkNonce(index, index === count - 1),
        ciphertext.slice(index * sealedChunkSize, (index + 1) * sealedChunkSize),
        additionalData
      )
    )
  );
  const chunks: TBytes[] = [];
  for (const chunk of opened) {
    if (!chunk.ok) {
      return err('corrupted');
    }
    chunks.push(chunk.value);
  }
  return ok(concatBytes(...chunks));
}
