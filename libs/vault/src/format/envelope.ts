import type { TResult } from '@frozik/utils/result/result';
import { err } from '@frozik/utils/result/result';

import type { TBytes } from '../crypto/bytes';
import { concatBytes } from '../crypto/bytes';
import { deriveAesKey } from '../crypto/hkdf';
import { pad, unpad } from '../crypto/padme';
import type { IStreamParams } from '../crypto/stream-cipher';
import { decryptStream, encryptStream } from '../crypto/stream-cipher';
import type { IDecodedHeader, IVaultHeader } from './header';
import { encodeHeader } from './header';

async function payloadStream(
  dek: CryptoKey,
  header: IVaultHeader,
  headerBytes: TBytes
): Promise<IStreamParams> {
  return {
    key: await deriveAesKey(dek, 'pwv/payload', header.saveSalt),
    chunkSize: header.chunkSize,
    additionalData: new Uint8Array(await crypto.subtle.digest('SHA-256', headerBytes)),
  };
}

/**
 * The header (with the padded length filled in) followed
 * by the padded content sealed as a STREAM under K_payload; the header's
 * hash is the additional data of every chunk, so it cannot be altered.
 */
export async function sealEnvelope(
  dek: CryptoKey,
  header: Omit<IVaultHeader, 'payloadLength'>,
  content: TBytes
): Promise<TBytes> {
  const padded = pad(content);
  const fullHeader: IVaultHeader = { ...header, payloadLength: padded.length };
  const headerBytes = encodeHeader(fullHeader);
  const ciphertext = await encryptStream(await payloadStream(dek, fullHeader, headerBytes), padded);
  return concatBytes(headerBytes, ciphertext);
}

export async function openEnvelope(
  dek: CryptoKey,
  { header, headerBytes }: IDecodedHeader,
  file: TBytes
): Promise<TResult<TBytes, 'corrupted'>> {
  const padded = await decryptStream(
    await payloadStream(dek, header, headerBytes),
    file.slice(headerBytes.length)
  );
  if (!padded.ok) {
    return padded;
  }
  return padded.value.length === header.payloadLength ? unpad(padded.value) : err('corrupted');
}
