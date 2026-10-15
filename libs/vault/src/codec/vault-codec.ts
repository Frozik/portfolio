import type { TResult } from '@frozik/utils/result/result';

import type { TBytes } from '../crypto/bytes';
import type { TFormatError } from '../format/format-errors';
import type { IVaultHeader } from '../format/header';
import type { TSlotSecret } from '../format/keyslot-changes';
import type { TManifest } from '../format/manifest';
import type { TUnlock } from '../format/open-vault';
import type { ISealContext } from '../format/seal-vault';
import type { IVaultKeys } from '../format/vault-keys';
import type { IVaultDocument } from '../model/vault-document';

export interface IOpenedVault {
  readonly header: IVaultHeader;
  readonly keys: IVaultKeys;
  readonly manifest: TManifest;
  readonly document: IVaultDocument;
  readonly access: 'read-write' | 'read-only';
}

export type TCodecError =
  | TFormatError
  | { readonly kind: 'aborted' }
  | { readonly kind: 'worker-crashed' };

/**
 * The whole of opening and sealing, from bytes to the
 * document and back. Stateless: the key travels with every call, so the
 * session stays its only owner and a crashed Worker costs a restart, not a lock.
 */
export interface IVaultCodec {
  /** Calibrates Argon2 on this device, then makes the id, the key and its password slot. */
  createKeys(password: TBytes, signal: AbortSignal): Promise<TResult<IVaultKeys, TCodecError>>;
  /**
   * A new password slot for the same key: calibrated on this
   * device, the current password checked by unwrapping it once more.
   */
  changePassword(
    keys: IVaultKeys,
    change: { readonly current: TSlotSecret; readonly next: TBytes },
    signal: AbortSignal
  ): Promise<TResult<IVaultKeys, TCodecError>>;
  /** A new key behind one password slot; the password must open the current one. */
  rotateKey(
    keys: IVaultKeys,
    password: TBytes,
    signal: AbortSignal
  ): Promise<TResult<IVaultKeys, TCodecError>>;
  /** A passkey's slot: its PRF output for the vault's salt wraps the key. */
  addPasskey(
    keys: IVaultKeys,
    change: {
      readonly current: TSlotSecret;
      readonly credentialId: TBytes;
      readonly rpId: string;
      readonly prfOutput: TBytes;
    },
    signal: AbortSignal
  ): Promise<TResult<IVaultKeys, TCodecError>>;
  /** A recovery slot for the key, replacing an earlier one. */
  addRecoveryKey(
    keys: IVaultKeys,
    change: { readonly current: TSlotSecret; readonly recoveryKey: TBytes },
    signal: AbortSignal
  ): Promise<TResult<IVaultKeys, TCodecError>>;
  open(
    file: TBytes,
    unlock: TUnlock,
    signal: AbortSignal
  ): Promise<TResult<IOpenedVault, TCodecError>>;
  seal(
    document: IVaultDocument,
    manifest: TManifest,
    context: ISealContext,
    signal: AbortSignal
  ): Promise<TResult<TBytes, TCodecError>>;
}
