import { err, ok } from '@frozik/utils/result/result';
import { fromBase64Url, toBase64Url } from '@frozik/vault/crypto/bytes';
import { getEnrolledLevelAsync, SecurityLevel } from 'expo-local-authentication';
import { deleteItemAsync, getItemAsync, setItemAsync } from 'expo-secure-store';
import { isNil } from 'lodash-es';

import type { IBiometricSecrets } from '@frozik/vault-app/keys/domain/ports/biometric-secrets';
import type {
  TBiometricClass,
  TDeviceUnlockFailure,
} from '@frozik/vault-app/keys/domain/ports/device-unlock';

const GUARDED = { requireAuthentication: true } as const;
/** BiometricPrompt reports both the cancel and the negative button this way, on a write as on a read. */
const CANCELLED_MESSAGE = 'User canceled';

const secretKeyOf = (vaultKey: string): string => `vault-secret.${vaultKey}`;
/** Whether a secret was kept, readable without a prompt: an invalidated key reads back as nothing. */
const markerKeyOf = (vaultKey: string): string => `vault-enrolled.${vaultKey}`;

function failureOf(error: unknown): TDeviceUnlockFailure {
  return error instanceof Error && error.message.includes(CANCELLED_MESSAGE)
    ? 'cancelled'
    : 'unavailable';
}

function biometricClassOf(level: SecurityLevel): TBiometricClass {
  switch (level) {
    case SecurityLevel.BIOMETRIC_STRONG:
      return 'strong';
    case SecurityLevel.BIOMETRIC_WEAK:
      return 'weak';
    default:
      return 'none';
  }
}

/**
 * The Android Keystore behind `BiometricPrompt`, through `expo-secure-store`.
 * Its values are strings, so the secret crosses the bridge as base64 — a copy
 * the JS heap cannot zero, which the README names among the weaker spots.
 */
export const SECURE_STORE_BIOMETRIC_SECRETS: IBiometricSecrets = {
  available: async () => biometricClassOf(await getEnrolledLevelAsync()),
  has: async vaultKey => !isNil(await getItemAsync(markerKeyOf(vaultKey))),
  async put(vaultKey, secret) {
    try {
      await setItemAsync(secretKeyOf(vaultKey), toBase64Url(secret), GUARDED);
      await setItemAsync(markerKeyOf(vaultKey), '1');
      return ok(undefined);
    } catch (error) {
      return err(failureOf(error));
    }
  },
  async take(vaultKey) {
    let stored: string | null;
    try {
      stored = await getItemAsync(secretKeyOf(vaultKey), GUARDED);
    } catch (error) {
      return err(
        error instanceof Error && error.message.includes(CANCELLED_MESSAGE)
          ? 'cancelled'
          : 'unavailable'
      );
    }
    if (isNil(stored)) {
      return err(isNil(await getItemAsync(markerKeyOf(vaultKey))) ? 'unavailable' : 'invalidated');
    }
    const secret = fromBase64Url(stored);
    return isNil(secret) ? err('unavailable') : ok(secret);
  },
  async forget(vaultKey) {
    await deleteItemAsync(secretKeyOf(vaultKey), GUARDED);
    await deleteItemAsync(markerKeyOf(vaultKey));
  },
};
