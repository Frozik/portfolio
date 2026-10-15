import { assertNever } from '@frozik/utils/assert/assertNever';
import type { TResult } from '@frozik/utils/result/result';
import { err, ok } from '@frozik/utils/result/result';

import type { TBytes } from '../crypto/bytes';
import { bytesEqual } from '../crypto/bytes';
import { deriveKeyCheck } from '../crypto/dek';
import type { IKdf } from '../crypto/kdf-port';
import type { TKeyslot } from '../crypto/keyslot';
import { deriveSlotKek, unwrapDek } from '../crypto/keyslot';
import { unpackContainer } from './container';
import { openEnvelope } from './envelope';
import type { TFormatError } from './format-errors';
import type { IVaultHeader } from './header';
import { decodeHeader } from './header';
import type { TManifest } from './manifest';
import { CURRENT_SCHEMA_VERSION, decodeManifest, MANIFEST_PATH } from './manifest';
import type { IVaultKeys } from './vault-keys';

export type TUnlock =
  | { readonly kind: 'password'; readonly password: TBytes }
  | { readonly kind: 'recovery'; readonly recoveryKey: TBytes }
  | { readonly kind: 'prf'; readonly credentialId: TBytes; readonly prfOutput: TBytes }
  /** An unlocked session re-reading the file: no KDF, only the key id is compared. */
  | { readonly kind: 'session'; readonly dek: CryptoKey; readonly keyId: TBytes };

/** The secret bytes an unlock carries, for the holder to zero once used (best effort: JS strings are not). */
export function unlockSecretOf(unlock: TUnlock): TBytes | null {
  switch (unlock.kind) {
    case 'password':
      return unlock.password;
    case 'recovery':
      return unlock.recoveryKey;
    case 'prf':
      return unlock.prfOutput;
    case 'session':
      return null;
    default:
      return assertNever(unlock);
  }
}

export interface IOpenedVaultFile {
  readonly header: IVaultHeader;
  readonly keys: IVaultKeys;
  readonly manifest: TManifest;
  /** The container's files but the manifest. */
  readonly entries: ReadonlyMap<string, TBytes>;
  /** A newer document schema opens read-only: writing it back could drop what this build cannot see. */
  readonly access: 'read-write' | 'read-only';
}

interface ISlotChoice {
  readonly slots: readonly TKeyslot[];
  readonly secret: TBytes;
}

function slotsFor(
  unlock: Exclude<TUnlock, { kind: 'session' }>,
  keyslots: readonly TKeyslot[]
): ISlotChoice {
  switch (unlock.kind) {
    case 'password':
      return { slots: keyslots.filter(slot => slot.kind === 'password'), secret: unlock.password };
    case 'recovery':
      return {
        slots: keyslots.filter(slot => slot.kind === 'recovery'),
        secret: unlock.recoveryKey,
      };
    case 'prf':
      return {
        slots: keyslots.filter(
          slot => slot.kind === 'prf' && bytesEqual(slot.credentialId, unlock.credentialId)
        ),
        secret: unlock.prfOutput,
      };
    default:
      return assertNever(unlock);
  }
}

async function unlockDek(
  unlock: TUnlock,
  header: IVaultHeader,
  argon2: IKdf
): Promise<TResult<CryptoKey, TFormatError>> {
  if (unlock.kind === 'session') {
    return bytesEqual(unlock.keyId, header.keyId) ? ok(unlock.dek) : err({ kind: 'key-rotated' });
  }
  const { slots, secret } = slotsFor(unlock, header.keyslots);
  for (const slot of slots) {
    const dek = await unwrapDek(slot, await deriveSlotKek(slot, secret, argon2), header.vaultId);
    if (dek.ok) {
      return bytesEqual(await deriveKeyCheck(dek.value), header.keyCheck)
        ? dek
        : err({ kind: 'slot-tampered' });
    }
  }
  return err({ kind: 'wrong-password' });
}

/** Header, slot, payload, padding, container and manifest, each failure a value. */
export async function openVaultFile(
  file: TBytes,
  unlock: TUnlock,
  argon2: IKdf
): Promise<TResult<IOpenedVaultFile, TFormatError>> {
  const decoded = decodeHeader(file);
  if (!decoded.ok) {
    return err({ kind: decoded.error });
  }
  const { header } = decoded.value;
  const dek = await unlockDek(unlock, header, argon2);
  if (!dek.ok) {
    return dek;
  }
  const zip = await openEnvelope(dek.value, decoded.value, file);
  if (!zip.ok) {
    return err({ kind: zip.error });
  }
  const files = unpackContainer(zip.value);
  if (!files.ok) {
    return err({ kind: files.error });
  }
  const manifest = decodeManifest(files.value.get(MANIFEST_PATH));
  if (!manifest.ok) {
    return err({ kind: manifest.error });
  }
  const entries = new Map(files.value);
  entries.delete(MANIFEST_PATH);
  return ok({
    header,
    keys: {
      vaultId: header.vaultId,
      dek: dek.value,
      keyCheck: header.keyCheck,
      keyId: header.keyId,
      keyslots: header.keyslots,
      keyslotsEpoch: header.keyslotsEpoch,
      keyGeneration: header.keyGeneration,
      preserved: header.preserved,
    },
    manifest: manifest.value,
    entries,
    access: manifest.value.schemaVersion > CURRENT_SCHEMA_VERSION ? 'read-only' : 'read-write',
  });
}
