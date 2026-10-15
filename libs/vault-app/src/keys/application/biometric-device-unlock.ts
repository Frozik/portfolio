import { err, ok } from '@frozik/utils/result/result';
import { DEK_BYTES, importDek, KEY_ID_BYTES } from '@frozik/vault/crypto/dek';
import type { IKdf } from '@frozik/vault/crypto/kdf-port';
import { rawDekBy } from '@frozik/vault/format/keyslot-changes';

import type { IBiometricSecrets } from '../domain/ports/biometric-secrets';
import type { IDeviceUnlock } from '../domain/ports/device-unlock';

/** The raw key and the id it is checked against, as one secret. */
const SECRET_BYTES = DEK_BYTES + KEY_ID_BYTES;

/**
 * Biometric unlock over a platform's biometric store. Only a phone builds it:
 * the raw key passes through this process, which the web's main thread never allows.
 */
export function createBiometricDeviceUnlock(
  secrets: IBiometricSecrets,
  argon2: IKdf
): IDeviceUnlock {
  return {
    available: () => secrets.available(),
    isEnrolled: vaultKey => secrets.has(vaultKey),
    async enroll(vaultKey, keys, password) {
      if ((await secrets.available()) !== 'strong') {
        return err('unavailable');
      }
      const raw = await rawDekBy(keys, { kind: 'password', password }, argon2);
      if (!raw.ok) {
        return raw;
      }
      const secret = new Uint8Array(SECRET_BYTES);
      secret.set(raw.value);
      secret.set(keys.keyId, DEK_BYTES);
      raw.value.fill(0);
      const kept = await secrets.put(vaultKey, secret);
      secret.fill(0);
      return kept;
    },
    async unlock(vaultKey) {
      const taken = await secrets.take(vaultKey);
      if (!taken.ok) {
        return taken;
      }
      const secret = taken.value;
      if (secret.length !== SECRET_BYTES) {
        secret.fill(0);
        await secrets.forget(vaultKey);
        return err('unavailable');
      }
      try {
        return ok({
          dek: await importDek(secret.subarray(0, DEK_BYTES)),
          keyId: secret.slice(DEK_BYTES),
        });
      } finally {
        secret.fill(0);
      }
    },
    forget: vaultKey => secrets.forget(vaultKey),
  };
}
