import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';
import { unzlibSync } from 'fflate';
import { isNil } from 'lodash-es';

import type { TBytes } from '../../crypto/bytes';
import { bytesEqual, utf8Text } from '../../crypto/bytes';
import { ByteReader } from '../../format/byte-reader';
import {
  CHECK_ROUNDS,
  LATIN1_PASSWORD,
  PASSWORD_ROUNDS,
  pbkdf2Sha1,
  SAFEINCLOUD_MAGIC,
  safeInCloudPasswordBytes,
} from '../../format/safeincloud-db-format';
import type { IImportBatch } from '../imported-card';
import { importSafeInCloud } from './map-safeincloud';
import { parseSafeInCloud } from './parse-safeincloud';

export type TSafeInCloudDbError = 'wrong-password' | 'unreadable';

export function startsWithSafeInCloudMagic(bytes: Uint8Array): boolean {
  return SAFEINCLOUD_MAGIC.every((byte, index) => bytes[index] === byte);
}

interface ISafeInCloudHeader {
  readonly latin1: boolean;
  readonly salt: TBytes;
  readonly iv: TBytes;
  readonly checkSalt: TBytes;
  readonly sealedKeys: TBytes;
  readonly sealedData: TBytes;
}

/** Each field of the header is its length in one byte, then the bytes. */
function shortField(reader: ByteReader): TBytes | null {
  if (!reader.has(1)) {
    return null;
  }
  const length = reader.u8();
  return reader.has(length) ? reader.take(length) : null;
}

function headerOf(file: TBytes): ISafeInCloudHeader | null {
  const reader = new ByteReader(file);
  if (!startsWithSafeInCloudMagic(file) || !reader.has(SAFEINCLOUD_MAGIC.length + 1)) {
    return null;
  }
  reader.take(SAFEINCLOUD_MAGIC.length);
  const latin1 = reader.u8() === LATIN1_PASSWORD;
  const salt = shortField(reader);
  const iv = shortField(reader);
  const checkSalt = shortField(reader);
  const sealedKeys = shortField(reader);
  if (isNil(salt) || isNil(iv) || isNil(checkSalt) || isNil(sealedKeys)) {
    return null;
  }
  return { latin1, salt, iv, checkSalt, sealedKeys, sealedData: reader.take(reader.remaining) };
}

/** AES-256-CBC with PKCS#7 padding; `null` when the padding does not check out. */
async function openCbc(key: TBytes, iv: TBytes, sealed: TBytes): Promise<TBytes | null> {
  try {
    const aesKey = await crypto.subtle.importKey('raw', key, 'AES-CBC', false, ['decrypt']);
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CBC', iv }, aesKey, sealed));
  } catch {
    return null;
  }
}

/**
 * The password opens a small block holding the data key, its IV and a check
 * value; the check — PBKDF2 of the data key — tells a wrong password apart
 * from a damaged file, since CBC has no tag of its own.
 */
async function dataKeyWith(
  header: ISafeInCloudHeader,
  passwordBytes: TBytes
): Promise<TResult<{ readonly key: TBytes; readonly iv: TBytes }, TSafeInCloudDbError>> {
  const passwordKey = await pbkdf2Sha1(passwordBytes, header.salt, PASSWORD_ROUNDS);
  const keys = await openCbc(passwordKey, header.iv, header.sealedKeys);
  if (isNil(keys)) {
    return err('wrong-password');
  }
  const reader = new ByteReader(keys);
  const iv = shortField(reader);
  const key = shortField(reader);
  const check = shortField(reader);
  if (isNil(iv) || isNil(key) || isNil(check)) {
    return err('wrong-password');
  }
  const expected = await pbkdf2Sha1(key, header.checkSalt, CHECK_ROUNDS);
  return bytesEqual(expected, check) ? ok({ key, iv }) : err('wrong-password');
}

/**
 * The header's flag says how the password became bytes, and that encoding is tried first; the
 * other one follows, since a file whose flag says otherwise still holds the same password.
 */
async function dataKeyOf(
  header: ISafeInCloudHeader,
  password: string
): Promise<TResult<{ readonly key: TBytes; readonly iv: TBytes }, TSafeInCloudDbError>> {
  const flagged = await dataKeyWith(header, safeInCloudPasswordBytes(password, header.latin1));
  return flagged.ok
    ? flagged
    : dataKeyWith(header, safeInCloudPasswordBytes(password, !header.latin1));
}

function inflated(bytes: TBytes): Uint8Array | null {
  try {
    return unzlibSync(bytes);
  } catch {
    return null;
  }
}

/** A SafeInCloud database (`.db`): sealed with its password, inside it the same XML its export writes. */
export async function readSafeInCloudDb(
  file: TBytes,
  password: string
): Promise<TResult<IImportBatch, TSafeInCloudDbError>> {
  const header = headerOf(file);
  if (isNil(header)) {
    return err('unreadable');
  }
  const dataKey = await dataKeyOf(header, password);
  if (!dataKey.ok) {
    return dataKey;
  }
  const compressed = await openCbc(dataKey.value.key, dataKey.value.iv, header.sealedData);
  const xml = isNil(compressed) ? null : inflated(compressed);
  const text = isNil(xml) ? null : utf8Text(xml);
  const database = isNil(text) ? null : parseSafeInCloud(text);
  return isNil(database) ? err('unreadable') : ok(await importSafeInCloud(database));
}
