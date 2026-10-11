import { assertNever } from '@frozik/utils/assert/assertNever';
import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';

import type { IRandom } from '../ports/random';
import { NONCE_BYTES, openBlock, sealBlock } from './aead';
import type { TBytes } from './bytes';
import { concatBytes, utf8 } from './bytes';
import { DEK_BYTES } from './dek';
import { deriveAesKey, importHkdfKey } from './hkdf';
import type { IArgon2Params, IKdf } from './kdf-port';
import { isOperationError } from './operation-error';

export const KEYSLOT_SALT_BYTES = 16;
export const WRAPPED_DEK_BYTES = 48;

const AES_KEY_BITS = 256;
const KEK_USAGES: readonly KeyUsage[] = ['encrypt', 'decrypt', 'unwrapKey'];
const DEK_USAGES: readonly KeyUsage[] = ['deriveBits', 'deriveKey'];

export type TPasswordKdf =
  | { readonly kind: 'argon2id'; readonly params: IArgon2Params }
  | { readonly kind: 'pbkdf2-sha256'; readonly iterations: number };

interface IKeyslotSealing {
  readonly salt: TBytes;
  readonly wrapNonce: TBytes;
  readonly wrappedDek: TBytes;
}

export interface IPasswordKeyslot extends IKeyslotSealing {
  readonly kind: 'password';
  readonly kdf: TPasswordKdf;
}

export interface IPrfKeyslot extends IKeyslotSealing {
  readonly kind: 'prf';
  readonly credentialId: TBytes;
}

export interface IRecoveryKeyslot extends IKeyslotSealing {
  readonly kind: 'recovery';
}

/** Like LUKS: each slot wraps the same DEK under its own KEK. */
export type TKeyslot = IPasswordKeyslot | IPrfKeyslot | IRecoveryKeyslot;

/** What a new slot is made of; a new password slot is always Argon2id, PBKDF2 is only read. */
export type TNewKeyslot =
  | { readonly kind: 'password'; readonly params: IArgon2Params }
  | { readonly kind: 'prf'; readonly credentialId: TBytes }
  | { readonly kind: 'recovery' };

/** Everything a KEK is derived from besides the secret — a stored slot satisfies it as is. */
type TKekSource =
  | { readonly kind: 'password'; readonly kdf: TPasswordKdf; readonly salt: TBytes }
  | { readonly kind: 'prf' | 'recovery'; readonly salt: TBytes };

export type TUnwrapError = 'wrong-secret';

const SLOT_KIND_CODES: Readonly<Record<TKeyslot['kind'], number>> = {
  password: 1,
  prf: 2,
  recovery: 3,
};

/**
 * Binds a wrapped DEK to its vault and slot kind. The slot epoch is
 * deliberately left out: binding it would force re-wrapping the passkey slot
 * (a passkey ceremony) on every password change, while rollback is already
 * caught by the epoch in the header.
 */
function slotAdditionalData(vaultId: TBytes, kind: TKeyslot['kind']): TBytes {
  return concatBytes(utf8('pwv/slot'), vaultId, Uint8Array.of(SLOT_KIND_CODES[kind]));
}

async function deriveArgon2Kek(
  password: TBytes,
  salt: TBytes,
  params: IArgon2Params,
  argon2: IKdf
): Promise<CryptoKey> {
  const material = await argon2.argon2id(password, salt, params);
  try {
    return await crypto.subtle.importKey(
      'raw',
      material,
      { name: 'AES-GCM', length: AES_KEY_BITS },
      false,
      [...KEK_USAGES]
    );
  } finally {
    material.fill(0);
  }
}

async function derivePbkdf2Kek(
  password: TBytes,
  salt: TBytes,
  iterations: number
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey('raw', password, 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    baseKey,
    { name: 'AES-GCM', length: AES_KEY_BITS },
    false,
    [...KEK_USAGES]
  );
}

async function deriveHkdfKek(
  secret: TBytes,
  label: 'pwv/prf-kek' | 'pwv/recovery-kek',
  salt: TBytes
): Promise<CryptoKey> {
  return deriveAesKey(await importHkdfKey(secret), label, salt, KEK_USAGES);
}

/**
 * The key-encryption key of a slot from its secret — the NFC-encoded
 * password, the passkey PRF output or the recovery key. Only the password
 * needs Argon2; the other two are already high-entropy, so HKDF is enough.
 */
export function deriveSlotKek(
  source: TKekSource,
  secret: TBytes,
  argon2: IKdf
): Promise<CryptoKey> {
  switch (source.kind) {
    case 'password':
      return source.kdf.kind === 'argon2id'
        ? deriveArgon2Kek(secret, source.salt, source.kdf.params, argon2)
        : derivePbkdf2Kek(secret, source.salt, source.kdf.iterations);
    case 'prf':
      return deriveHkdfKek(secret, 'pwv/prf-kek', source.salt);
    case 'recovery':
      return deriveHkdfKek(secret, 'pwv/recovery-kek', source.salt);
    default:
      return assertNever(source);
  }
}

function sourceOf(spec: TNewKeyslot, salt: TBytes): TKekSource {
  return spec.kind === 'password'
    ? { kind: 'password', kdf: { kind: 'argon2id', params: spec.params }, salt }
    : { kind: spec.kind, salt };
}

/**
 * Wraps the raw DEK under a new slot. The raw DEK exists only while a slot is
 * created or the key rotated; the caller zeroes it afterwards.
 */
export async function createKeyslot(
  spec: TNewKeyslot,
  secret: TBytes,
  rawDek: TBytes,
  vaultId: TBytes,
  { argon2, random }: { readonly argon2: IKdf; readonly random: IRandom }
): Promise<TKeyslot> {
  const salt = random.bytes(KEYSLOT_SALT_BYTES);
  const wrapNonce = random.bytes(NONCE_BYTES);
  const kek = await deriveSlotKek(sourceOf(spec, salt), secret, argon2);
  const wrappedDek = await sealBlock(
    kek,
    wrapNonce,
    rawDek,
    slotAdditionalData(vaultId, spec.kind)
  );
  const sealing = { salt, wrapNonce, wrappedDek };
  switch (spec.kind) {
    case 'password':
      return { kind: 'password', kdf: { kind: 'argon2id', params: spec.params }, ...sealing };
    case 'prf':
      return { kind: 'prf', credentialId: spec.credentialId, ...sealing };
    case 'recovery':
      return { kind: 'recovery', ...sealing };
    default:
      return assertNever(spec);
  }
}

/** The web path: the DEK lands as a non-extractable HKDF key, raw bytes never appear. */
export async function unwrapDek(
  slot: TKeyslot,
  kek: CryptoKey,
  vaultId: TBytes
): Promise<TResult<CryptoKey, TUnwrapError>> {
  try {
    const dek = await crypto.subtle.unwrapKey(
      'raw',
      slot.wrappedDek,
      kek,
      {
        name: 'AES-GCM',
        iv: slot.wrapNonce,
        additionalData: slotAdditionalData(vaultId, slot.kind),
      },
      'HKDF',
      false,
      [...DEK_USAGES]
    );
    return ok(dek);
  } catch (error) {
    if (isOperationError(error)) {
      return err('wrong-secret');
    }
    throw error;
  }
}

/**
 * The extension path and the slot-changing path: the raw
 * 32 bytes, for `chrome.storage.session` or for wrapping into another slot.
 */
export async function unwrapDekBytes(
  slot: TKeyslot,
  kek: CryptoKey,
  vaultId: TBytes
): Promise<TResult<TBytes, TUnwrapError>> {
  const opened = await openBlock(
    kek,
    slot.wrapNonce,
    slot.wrappedDek,
    slotAdditionalData(vaultId, slot.kind)
  );
  if (!opened.ok || opened.value.length !== DEK_BYTES) {
    return err('wrong-secret');
  }
  return ok(opened.value);
}
