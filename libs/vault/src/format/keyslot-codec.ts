import { assertNever } from '@frozik/utils/assert/assertNever';
import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';
import { isNil } from 'lodash-es';

import { NONCE_BYTES } from '../crypto/aead';
import type { TBytes } from '../crypto/bytes';
import { isArgon2WithinBounds, isPbkdf2WithinBounds } from '../crypto/kdf-port';
import type { TKeyslot, TPasswordKdf } from '../crypto/keyslot';
import { KEYSLOT_SALT_BYTES, WRAPPED_DEK_BYTES } from '../crypto/keyslot';
import { ByteReader } from './byte-reader';
import { ByteWriter } from './byte-writer';

/** The wire codes of slot kinds and KDFs. */
const KIND_CODES = { password: 1, prf: 2, recovery: 3 } as const;
const KDF_CODES = { argon2id: 1, 'pbkdf2-sha256': 2, hkdf: 3 } as const;

const ARGON2_PARAMS_BYTES = 9;
const PBKDF2_PARAMS_BYTES = 4;
const SEALING_BYTES = KEYSLOT_SALT_BYTES + NONCE_BYTES + WRAPPED_DEK_BYTES;
const CREDENTIAL_LENGTH_BYTES = 2;

export type TKeyslotDecodeError = 'corrupted' | 'unsupported-format';

function writePasswordKdf(writer: ByteWriter, kdf: TPasswordKdf): void {
  switch (kdf.kind) {
    case 'argon2id':
      writer
        .u8(KDF_CODES.argon2id)
        .u32(kdf.params.memoryKib)
        .u32(kdf.params.iterations)
        .u8(kdf.params.parallelism);
      return;
    case 'pbkdf2-sha256':
      writer.u8(KDF_CODES['pbkdf2-sha256']).u32(kdf.iterations);
      return;
    default:
      assertNever(kdf);
  }
}

export function encodeKeyslot(slot: TKeyslot): TBytes {
  const writer = new ByteWriter().u8(KIND_CODES[slot.kind]);
  if (slot.kind === 'password') {
    writePasswordKdf(writer, slot.kdf);
  } else {
    writer.u8(KDF_CODES.hkdf);
  }
  writer.bytes(slot.salt).bytes(slot.wrapNonce).bytes(slot.wrappedDek);
  if (slot.kind === 'prf') {
    writer.u16(slot.credentialId.length).bytes(slot.credentialId);
  }
  return writer.toBytes();
}

/** Parameters outside the floor and the ceiling refuse the file. */
function readPasswordKdf(
  reader: ByteReader,
  kdfCode: number
): TResult<TPasswordKdf, TKeyslotDecodeError> {
  switch (kdfCode) {
    case KDF_CODES.argon2id: {
      if (!reader.has(ARGON2_PARAMS_BYTES)) {
        return err('corrupted');
      }
      const params = {
        memoryKib: reader.u32(),
        iterations: reader.u32(),
        parallelism: reader.u8(),
      };
      return isArgon2WithinBounds(params)
        ? ok({ kind: 'argon2id', params })
        : err('unsupported-format');
    }
    case KDF_CODES['pbkdf2-sha256']: {
      if (!reader.has(PBKDF2_PARAMS_BYTES)) {
        return err('corrupted');
      }
      const iterations = reader.u32();
      return isPbkdf2WithinBounds(iterations)
        ? ok({ kind: 'pbkdf2-sha256', iterations })
        : err('unsupported-format');
    }
    default:
      return err('unsupported-format');
  }
}

function readSealing(
  reader: ByteReader
): TResult<Pick<TKeyslot, 'salt' | 'wrapNonce' | 'wrappedDek'>, 'corrupted'> {
  if (!reader.has(SEALING_BYTES)) {
    return err('corrupted');
  }
  return ok({
    salt: reader.take(KEYSLOT_SALT_BYTES),
    wrapNonce: reader.take(NONCE_BYTES),
    wrappedDek: reader.take(WRAPPED_DEK_BYTES),
  });
}

function readCredentialId(reader: ByteReader): TBytes | null {
  if (!reader.has(CREDENTIAL_LENGTH_BYTES)) {
    return null;
  }
  const length = reader.u16();
  return reader.has(length) ? reader.take(length) : null;
}

/**
 * A slot of a kind or KDF this build does not know refuses the file: it is a
 * newer format. A passkey's site lives outside its slot, so older builds read the slot unchanged.
 */
export function decodeKeyslot(
  value: TBytes,
  siteOf: (credentialId: TBytes) => string | null
): TResult<TKeyslot, TKeyslotDecodeError> {
  const reader = new ByteReader(value);
  if (!reader.has(2)) {
    return err('corrupted');
  }
  const kindCode = reader.u8();
  const kdfCode = reader.u8();
  if (kindCode === KIND_CODES.password) {
    const kdf = readPasswordKdf(reader, kdfCode);
    if (!kdf.ok) {
      return kdf;
    }
    const sealing = readSealing(reader);
    if (!sealing.ok) {
      return sealing;
    }
    return reader.remaining === 0
      ? ok({ kind: 'password', kdf: kdf.value, ...sealing.value })
      : err('corrupted');
  }
  if (
    (kindCode !== KIND_CODES.prf && kindCode !== KIND_CODES.recovery) ||
    kdfCode !== KDF_CODES.hkdf
  ) {
    return err('unsupported-format');
  }
  const sealing = readSealing(reader);
  if (!sealing.ok) {
    return sealing;
  }
  if (kindCode === KIND_CODES.recovery) {
    return reader.remaining === 0 ? ok({ kind: 'recovery', ...sealing.value }) : err('corrupted');
  }
  const credentialId = readCredentialId(reader);
  return !isNil(credentialId) && reader.remaining === 0
    ? ok({ kind: 'prf', credentialId, rpId: siteOf(credentialId), ...sealing.value })
    : err('corrupted');
}
