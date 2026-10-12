import { zlibSync } from 'fflate';

import type { TBytes } from '../crypto/bytes';
import { concatBytes, utf8 } from '../crypto/bytes';

const SALT_BYTES = 32;
const IV_BYTES = 16;
const KEY_BITS = 256;
const PASSWORD_ROUNDS = 10_000;
const CHECK_ROUNDS = 1_000;
const MAGIC = [0x05, 0x05] as const;
const LATIN1_PASSWORD = 1;
const UTF8_PASSWORD = 0;

function randomBytes(length: number): TBytes {
  return crypto.getRandomValues(new Uint8Array(length));
}

function shortField(bytes: Uint8Array): TBytes {
  return concatBytes(Uint8Array.of(bytes.length), bytes);
}

async function pbkdf2Sha1(secret: TBytes, salt: TBytes, rounds: number): Promise<TBytes> {
  const material = await crypto.subtle.importKey('raw', secret, 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-1', salt, iterations: rounds },
    material,
    KEY_BITS
  );
  return new Uint8Array(bits);
}

async function sealCbc(key: TBytes, iv: TBytes, plaintext: TBytes): Promise<TBytes> {
  const aesKey = await crypto.subtle.importKey('raw', key, 'AES-CBC', false, ['encrypt']);
  return new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, aesKey, plaintext));
}

/** A SafeInCloud database written the way the app writes it, from its XML and password. */
export async function aSafeInCloudDb(
  xml: string,
  password: string,
  { latin1 = false }: { readonly latin1?: boolean } = {}
): Promise<TBytes> {
  const salt = randomBytes(SALT_BYTES);
  const iv = randomBytes(IV_BYTES);
  const checkSalt = randomBytes(SALT_BYTES);
  const dataIv = randomBytes(IV_BYTES);
  const dataKey = randomBytes(KEY_BITS / 8);
  const secret = latin1
    ? Uint8Array.from(password, character => character.charCodeAt(0))
    : utf8(password);
  const passwordKey = await pbkdf2Sha1(secret, salt, PASSWORD_ROUNDS);
  const check = await pbkdf2Sha1(dataKey, checkSalt, CHECK_ROUNDS);
  const sealedKeys = await sealCbc(
    passwordKey,
    iv,
    concatBytes(shortField(dataIv), shortField(dataKey), shortField(check))
  );
  const sealedData = await sealCbc(dataKey, dataIv, new Uint8Array(zlibSync(utf8(xml))));
  return concatBytes(
    Uint8Array.of(...MAGIC, latin1 ? LATIN1_PASSWORD : UTF8_PASSWORD),
    shortField(salt),
    shortField(iv),
    shortField(checkSalt),
    shortField(sealedKeys),
    sealedData
  );
}
