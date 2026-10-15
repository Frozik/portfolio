import { NONCE_BYTES, openBlock, sealBlock } from '@frozik/vault/crypto/aead';
import type { TBytes } from '@frozik/vault/crypto/bytes';
import { fromBase64Url, toBase64Url, utf8 } from '@frozik/vault/crypto/bytes';
import { DEK_BYTES, importDek, KEY_ID_BYTES } from '@frozik/vault/crypto/dek';
import type { IKdf } from '@frozik/vault/crypto/kdf-port';
import { encodePassword } from '@frozik/vault/crypto/password-normalization';
import { rawDekBy } from '@frozik/vault/format/keyslot-changes';
import type { TVaultKey } from '@frozik/vault/persistence/ports';
import type { IRandom } from '@frozik/vault/ports/random';
import { isNil } from 'lodash-es';
import { z } from 'zod';

import { quickPromptOf } from '../../keys/domain/quick-code';
import type { IQuickKeep, IQuickKeepStore } from '../domain/ports/quick-keep';
import { quickKeyOf } from '../domain/quick-key';

const PEPPER_BYTES = 32;
const SECRET_BYTES = DEK_BYTES + KEY_ID_BYTES;
const PEPPER_ALGORITHM: HmacImportParams = { name: 'HMAC', hash: 'SHA-256' };

const RECORD_SCHEMA = z.object({
  pepper: z.string(),
  nonce: z.string(),
  sealed: z.string(),
  prompt: z.union([
    z.object({ kind: z.literal('pin'), digits: z.int().positive() }),
    z.object({ kind: z.literal('pattern'), hideLine: z.boolean() }),
    z.object({ kind: z.enum(['first-four', 'last-four']) }),
  ]),
  expiresAt: z.number(),
});

type TRecord = z.infer<typeof RECORD_SCHEMA>;

function parseRecord(text: string): TRecord | null {
  try {
    const parsed = RECORD_SCHEMA.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function additionalData(vaultKey: TVaultKey): TBytes {
  return utf8(`pwv/quick-keep/${vaultKey}`);
}

async function keyFor(pepper: TBytes, canonicalCode: string): Promise<CryptoKey> {
  const hmac = await crypto.subtle.importKey('raw', pepper, PEPPER_ALGORITHM, false, ['sign']);
  return quickKeyOf(new Uint8Array(await crypto.subtle.sign('HMAC', hmac, utf8(canonicalCode))));
}

/**
 * The quick lock kept in a platform store across restarts: the raw key, read once with the master
 * password, sealed under the code mixed with a pepper kept beside it. The store's own encryption
 * (the Keystore) guards the record at rest; the one try and the lifetime guard the code.
 */
export function createQuickKeep(store: IQuickKeepStore, argon2: IKdf, random: IRandom): IQuickKeep {
  const read = (vaultKey: TVaultKey): TRecord | null => {
    const text = store.read(vaultKey);
    const record = isNil(text) ? null : parseRecord(text);
    if (!isNil(text) && isNil(record)) {
      store.remove(vaultKey);
    }
    return record;
  };
  return {
    async arm(vaultKey, keys, password, setting, now) {
      const encoded = encodePassword(password);
      const raw = await rawDekBy(keys, { kind: 'password', password: encoded }, argon2);
      encoded.fill(0);
      if (!raw.ok) {
        return;
      }
      const secret = new Uint8Array(SECRET_BYTES);
      secret.set(raw.value);
      secret.set(keys.keyId, DEK_BYTES);
      raw.value.fill(0);
      const pepper = random.bytes(PEPPER_BYTES);
      const nonce = random.bytes(NONCE_BYTES);
      const sealed = await sealBlock(
        await keyFor(pepper, setting.code),
        nonce,
        secret,
        additionalData(vaultKey)
      );
      secret.fill(0);
      const record: TRecord = {
        pepper: toBase64Url(pepper),
        nonce: toBase64Url(nonce),
        sealed: toBase64Url(sealed),
        prompt: quickPromptOf(setting),
        expiresAt: now + setting.lifetimeMs,
      };
      store.write(vaultKey, JSON.stringify(record));
    },
    kept(vaultKey, now) {
      const record = read(vaultKey);
      if (isNil(record)) {
        return null;
      }
      if (record.expiresAt <= now) {
        store.remove(vaultKey);
        return null;
      }
      return { prompt: record.prompt, expiresAt: record.expiresAt };
    },
    touch(vaultKey, lifetimeMs, now) {
      const record = read(vaultKey);
      if (!isNil(record)) {
        store.write(vaultKey, JSON.stringify({ ...record, expiresAt: now + lifetimeMs }));
      }
    },
    async open(vaultKey, canonicalCode) {
      const record = read(vaultKey);
      const pepper = isNil(record) ? null : fromBase64Url(record.pepper);
      const nonce = isNil(record) ? null : fromBase64Url(record.nonce);
      const sealed = isNil(record) ? null : fromBase64Url(record.sealed);
      if (isNil(pepper) || isNil(nonce) || isNil(sealed)) {
        store.remove(vaultKey);
        return null;
      }
      const opened = await openBlock(
        await keyFor(pepper, canonicalCode),
        nonce,
        sealed,
        additionalData(vaultKey)
      );
      if (!opened.ok || opened.value.length !== SECRET_BYTES) {
        store.remove(vaultKey);
        return null;
      }
      const secret = opened.value;
      try {
        return {
          dek: await importDek(secret.subarray(0, DEK_BYTES)),
          keyId: secret.slice(DEK_BYTES),
        };
      } finally {
        secret.fill(0);
      }
    },
    forget: vaultKey => store.remove(vaultKey),
  };
}
