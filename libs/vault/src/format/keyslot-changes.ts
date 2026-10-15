import { isNonEmpty } from '@frozik/utils/collections/non-empty';
import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';

import type { TBytes } from '../crypto/bytes';
import { bytesEqual } from '../crypto/bytes';
import { deriveKeyCheck, generateDek, importDek, keyIdOf } from '../crypto/dek';
import type { IArgon2Params, IKdf } from '../crypto/kdf-port';
import type { TKeyslot, TNewKeyslot } from '../crypto/keyslot';
import { createKeyslot, deriveSlotKek, unwrapDekBytes } from '../crypto/keyslot';
import type { IRandom } from '../ports/random';
import type { IVaultKeys } from './vault-keys';

export type TKeyslotChangeError = 'wrong-password' | 'slot-tampered';

/** What proves the user may change the slots: the master password, or the recovery key after a recovery. */
export type TSlotSecret =
  | { readonly kind: 'password'; readonly password: TBytes }
  | { readonly kind: 'recovery'; readonly recoveryKey: TBytes };

interface IKeyslotDependencies {
  readonly argon2: IKdf;
  readonly random: IRandom;
}

/** The secret's bytes, for the holder to zero once used. */
export function slotSecretBytes(secret: TSlotSecret): TBytes {
  return secret.kind === 'password' ? secret.password : secret.recoveryKey;
}

/**
 * A new slot needs the raw DEK, which the web session never
 * holds: a slot of the given kind unwraps it once more, and it must be the
 * key this session seals with.
 */
export async function rawDekBy(
  keys: Pick<IVaultKeys, 'keyslots' | 'vaultId' | 'keyCheck'>,
  secret: TSlotSecret,
  argon2: IKdf
): Promise<TResult<TBytes, TKeyslotChangeError>> {
  for (const slot of keys.keyslots.filter(candidate => candidate.kind === secret.kind)) {
    const raw = await unwrapDekBytes(
      slot,
      await deriveSlotKek(slot, slotSecretBytes(secret), argon2),
      keys.vaultId
    );
    if (!raw.ok) {
      continue;
    }
    if (bytesEqual(await deriveKeyCheck(await importDek(raw.value)), keys.keyCheck)) {
      return ok(raw.value);
    }
    raw.value.fill(0);
    return err('slot-tampered');
  }
  return err('wrong-password');
}

/** The slots a new one replaces: every one of its kind, but a passkey only its own credential's. */
function replacedBy(spec: TNewKeyslot, slot: TKeyslot): boolean {
  if (spec.kind !== 'prf') {
    return slot.kind === spec.kind;
  }
  return slot.kind === 'prf' && bytesEqual(slot.credentialId, spec.credentialId);
}

/** A new slot in place of those it replaces; the epoch rises so no device writes the old set back. */
async function withSlot(
  keys: IVaultKeys,
  current: TSlotSecret,
  spec: TNewKeyslot,
  secret: TBytes,
  dependencies: IKeyslotDependencies
): Promise<TResult<IVaultKeys, TKeyslotChangeError>> {
  const raw = await rawDekBy(keys, current, dependencies.argon2);
  if (!raw.ok) {
    return raw;
  }
  try {
    const slot = await createKeyslot(spec, secret, raw.value, keys.vaultId, dependencies);
    const others: readonly TKeyslot[] = keys.keyslots.filter(other => !replacedBy(spec, other));
    return ok({ ...keys, keyslots: [slot, ...others], keyslotsEpoch: keys.keyslotsEpoch + 1 });
  } finally {
    raw.value.fill(0);
  }
}

/**
 * The master password changes: the password slot is
 * replaced, the other slots (passkeys, the recovery key) stay. The DEK
 * itself is unchanged.
 */
export function withNewPassword(
  keys: IVaultKeys,
  {
    current,
    next,
    params,
  }: { readonly current: TSlotSecret; readonly next: TBytes; readonly params: IArgon2Params },
  dependencies: IKeyslotDependencies
): Promise<TResult<IVaultKeys, TKeyslotChangeError>> {
  return withSlot(keys, current, { kind: 'password', params }, next, dependencies);
}

/** A new recovery key replaces any earlier one: the old Emergency Kit stops opening the vault. */
export function withRecoveryKey(
  keys: IVaultKeys,
  { current, recoveryKey }: { readonly current: TSlotSecret; readonly recoveryKey: TBytes },
  dependencies: IKeyslotDependencies
): Promise<TResult<IVaultKeys, TKeyslotChangeError>> {
  return withSlot(keys, current, { kind: 'recovery' }, recoveryKey, dependencies);
}

/**
 * Rotation, when the key itself is suspect: a new DEK, its
 * KEY_CHECK and KEY_ID, and one password slot. Passkey and recovery slots
 * wrap the old key and cannot be re-made without their secrets: they go,
 * and the user makes them again.
 */
export async function withNewKey(
  keys: IVaultKeys,
  { password, params }: { readonly password: TBytes; readonly params: IArgon2Params },
  dependencies: IKeyslotDependencies
): Promise<TResult<IVaultKeys, TKeyslotChangeError>> {
  const raw = await rawDekBy(keys, { kind: 'password', password }, dependencies.argon2);
  if (!raw.ok) {
    return raw;
  }
  raw.value.fill(0);
  const rawDek = generateDek(dependencies.random);
  try {
    const slot = await createKeyslot(
      { kind: 'password', params },
      password,
      rawDek,
      keys.vaultId,
      dependencies
    );
    const dek = await importDek(rawDek);
    const keyCheck = await deriveKeyCheck(dek);
    return ok({
      vaultId: keys.vaultId,
      dek,
      keyCheck,
      keyId: await keyIdOf(keyCheck),
      keyslots: [slot],
      keyslotsEpoch: keys.keyslotsEpoch + 1,
      keyGeneration: keys.keyGeneration + 1,
      preserved: keys.preserved,
    });
  } finally {
    rawDek.fill(0);
  }
}

/**
 * A passkey on this or another device: its PRF output for the
 * vault's salt wraps the key. Each credential has its own slot.
 */
export function withPasskey(
  keys: IVaultKeys,
  {
    current,
    credentialId,
    rpId,
    prfOutput,
  }: {
    readonly current: TSlotSecret;
    readonly credentialId: TBytes;
    readonly rpId: string;
    readonly prfOutput: TBytes;
  },
  dependencies: IKeyslotDependencies
): Promise<TResult<IVaultKeys, TKeyslotChangeError>> {
  return withSlot(keys, current, { kind: 'prf', credentialId, rpId }, prfOutput, dependencies);
}

/** A passkey no longer opens the vault: no secret is needed to drop a slot, only a newer epoch. */
export function withoutPasskey(keys: IVaultKeys, credentialId: TBytes): IVaultKeys {
  const keyslots = keys.keyslots.filter(
    slot => slot.kind !== 'prf' || !bytesEqual(slot.credentialId, credentialId)
  );
  return isNonEmpty(keyslots) && keyslots.length < keys.keyslots.length
    ? { ...keys, keyslots, keyslotsEpoch: keys.keyslotsEpoch + 1 }
    : keys;
}
