import { assert } from '@frozik/utils/assert/assert';
import type { TNonEmptyArray } from '@frozik/utils/types/base';

import type { TBytes } from '../crypto/bytes';
import { deriveKeyCheck, generateDek, importDek, keyIdOf } from '../crypto/dek';
import type { IArgon2Params, IKdf } from '../crypto/kdf-port';
import { isArgon2WithinBounds } from '../crypto/kdf-port';
import type { TKeyslot } from '../crypto/keyslot';
import { createKeyslot } from '../crypto/keyslot';
import type { IRandom } from '../ports/random';
import { VAULT_ID_BYTES } from './header';

/** The key material a session seals with; the slots are the current set, not the last read header's. */
export interface IVaultKeys {
  readonly vaultId: TBytes;
  readonly dek: CryptoKey;
  readonly keyCheck: TBytes;
  readonly keyId: TBytes;
  readonly keyslots: TNonEmptyArray<TKeyslot>;
  readonly keyslotsEpoch: number;
  /** Rotations so far; a file under a lower one holds a retired key. */
  readonly keyGeneration: number;
}

/** A new vault: a random id and DEK behind one password slot; the raw DEK is zeroed. */
export async function createVaultKeys(
  password: TBytes,
  params: IArgon2Params,
  dependencies: { readonly argon2: IKdf; readonly random: IRandom }
): Promise<IVaultKeys> {
  assert(isArgon2WithinBounds(params), 'Argon2 parameters outside the bounds no reader accepts');
  const vaultId = dependencies.random.bytes(VAULT_ID_BYTES);
  const rawDek = generateDek(dependencies.random);
  try {
    const passwordSlot = await createKeyslot(
      { kind: 'password', params },
      password,
      rawDek,
      vaultId,
      dependencies
    );
    const dek = await importDek(rawDek);
    const keyCheck = await deriveKeyCheck(dek);
    return {
      vaultId,
      dek,
      keyCheck,
      keyId: await keyIdOf(keyCheck),
      keyslots: [passwordSlot],
      keyslotsEpoch: 0,
      keyGeneration: 0,
    };
  } finally {
    rawDek.fill(0);
  }
}
