import type { TResult } from '@frozik/utils/result/result';
import type { TBytes } from '@frozik/vault/crypto/bytes';
import type { TVaultKey } from '@frozik/vault/persistence/ports';

import type { TBiometricClass, TDeviceUnlockFailure } from './device-unlock';

/**
 * The platform's store of bytes only a strong biometric prompt releases (the
 * Android Keystore behind `BiometricPrompt`), one secret per vault. A new
 * enrolment invalidates what it holds.
 */
export interface IBiometricSecrets {
  available(): Promise<TBiometricClass>;
  has(vaultKey: TVaultKey): Promise<boolean>;
  put(vaultKey: TVaultKey, secret: TBytes): Promise<TResult<void, TDeviceUnlockFailure>>;
  /** Asks for the biometric; the caller zeroes the bytes once used. */
  take(vaultKey: TVaultKey): Promise<TResult<TBytes, TDeviceUnlockFailure>>;
  forget(vaultKey: TVaultKey): Promise<void>;
}
