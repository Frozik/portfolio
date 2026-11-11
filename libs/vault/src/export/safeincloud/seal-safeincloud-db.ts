import { zlibSync } from 'fflate';

import type { TBytes } from '../../crypto/bytes';
import { concatBytes, utf8 } from '../../crypto/bytes';
import {
  CHECK_ROUNDS,
  LATIN1_PASSWORD,
  PASSWORD_ROUNDS,
  pbkdf2Sha1,
  SAFEINCLOUD_KEY_BITS,
  SAFEINCLOUD_MAGIC,
  safeInCloudPasswordBytes,
  UTF8_PASSWORD,
} from '../../format/safeincloud-db-format';
import type { IRandom } from '../../ports/random';

/** The salts' and IVs' lengths in a database the app itself wrote. */
const SALT_BYTES = 64;
const IV_BYTES = 16;
const LATIN1_MAX = 0xff;

function shortField(bytes: TBytes): TBytes {
  return concatBytes(Uint8Array.of(bytes.length), bytes);
}

async function sealCbc(key: TBytes, iv: TBytes, plaintext: TBytes): Promise<TBytes> {
  const aesKey = await crypto.subtle.importKey('raw', key, 'AES-CBC', false, ['encrypt']);
  return new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, aesKey, plaintext));
}

/**
 * SafeInCloud's database (`.db`) holding this XML, sealed with this password as the app seals
 * it: a data key and IV of their own sealed under PBKDF2 of the password, the zlib'd XML under
 * the data key, AES-256-CBC both. The password goes one byte per character, as the app writes
 * it, unless it has characters past Latin-1: then UTF-8, which the header says.
 */
export async function sealSafeInCloudDb(
  xml: string,
  password: string,
  random: IRandom
): Promise<TBytes> {
  const latin1 = [...password].every(character => (character.codePointAt(0) ?? 0) <= LATIN1_MAX);
  const salt = random.bytes(SALT_BYTES);
  const iv = random.bytes(IV_BYTES);
  const checkSalt = random.bytes(SALT_BYTES);
  const dataIv = random.bytes(IV_BYTES);
  const dataKey = random.bytes(SAFEINCLOUD_KEY_BITS / 8);
  const passwordKey = await pbkdf2Sha1(
    safeInCloudPasswordBytes(password, latin1),
    salt,
    PASSWORD_ROUNDS
  );
  const check = await pbkdf2Sha1(dataKey, checkSalt, CHECK_ROUNDS);
  const sealedKeys = await sealCbc(
    passwordKey,
    iv,
    concatBytes(shortField(dataIv), shortField(dataKey), shortField(check))
  );
  const sealedData = await sealCbc(dataKey, dataIv, new Uint8Array(zlibSync(utf8(xml))));
  return concatBytes(
    Uint8Array.of(...SAFEINCLOUD_MAGIC, latin1 ? LATIN1_PASSWORD : UTF8_PASSWORD),
    shortField(salt),
    shortField(iv),
    shortField(checkSalt),
    shortField(sealedKeys),
    sealedData
  );
}
