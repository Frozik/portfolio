import type { TResult } from '@frozik/utils/result/result';
import type { TBytes } from '@frozik/vault/crypto/bytes';
import type { TKeyslotChangeError } from '@frozik/vault/format/keyslot-changes';
import type { IVaultKeys } from '@frozik/vault/format/vault-keys';
import type { TVaultKey } from '@frozik/vault/persistence/ports';

import type { ICustodyKey } from '../../../session/domain/ports/key-custody';

/** How strong the platform's biometrics are; only `strong` (Class 3) may open a vault. */
export type TBiometricClass = 'strong' | 'weak' | 'none';

export type TDeviceUnlockFailure =
  /** The user closed the prompt: no failure, the unlock screen stays as it was. */
  | 'cancelled'
  /** A new fingerprint or face was enrolled: the key behind the biometrics is gone. */
  | 'invalidated'
  | 'unavailable';

export type TEnrolmentFailure = TDeviceUnlockFailure | TKeyslotChangeError;

/** The session's current key slots: the master password proves itself against them once more. */
export type TEnrolmentKeys = Pick<IVaultKeys, 'keyslots' | 'vaultId' | 'keyCheck' | 'keyId'>;

/**
 * The platform's biometric unlock, one key per vault: the vault's key kept
 * behind a key only the biometric prompt releases. Survives a restart, unlike
 * a quick lock.
 */
export interface IDeviceUnlock {
  available(): Promise<TBiometricClass>;
  isEnrolled(vaultKey: TVaultKey): Promise<boolean>;
  /**
   * The session's key is not extractable, so the master password unwraps it
   * once more and the raw key goes behind the biometrics.
   */
  enroll(
    vaultKey: TVaultKey,
    keys: TEnrolmentKeys,
    password: TBytes
  ): Promise<TResult<void, TEnrolmentFailure>>;
  unlock(vaultKey: TVaultKey): Promise<TResult<ICustodyKey, TDeviceUnlockFailure>>;
  forget(vaultKey: TVaultKey): Promise<void>;
}
