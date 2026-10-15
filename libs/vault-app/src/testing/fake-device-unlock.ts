import { err, ok } from '@frozik/utils/result/result';
import type { TBytes } from '@frozik/vault/crypto/bytes';
import type { TVaultKey } from '@frozik/vault/persistence/ports';
import { createFakeKdf } from '@frozik/vault/testing/fake-kdf';
import { isNil } from 'lodash-es';

import { createBiometricDeviceUnlock } from '../keys/application/biometric-device-unlock';
import type { IBiometricSecrets } from '../keys/domain/ports/biometric-secrets';
import type { TBiometricClass } from '../keys/domain/ports/device-unlock';

/** A phone's biometrics under the test's hand: the user may cancel, or enrol a new finger. */
export function createFakeDeviceUnlock() {
  let biometricClass: TBiometricClass = 'strong';
  const kept = new Map<TVaultKey, TBytes>();
  let answer: 'yes' | 'cancel' = 'yes';
  let invalidated = false;
  const secrets: IBiometricSecrets = {
    available: () => Promise.resolve(biometricClass),
    has: vaultKey => Promise.resolve(kept.has(vaultKey) && !invalidated),
    put: (vaultKey, secret) => {
      if (answer === 'cancel') {
        return Promise.resolve(err('cancelled'));
      }
      invalidated = false;
      kept.set(vaultKey, secret.slice());
      return Promise.resolve(ok(undefined));
    },
    take: vaultKey => {
      const secret = kept.get(vaultKey);
      if (isNil(secret)) {
        return Promise.resolve(err('unavailable'));
      }
      if (invalidated) {
        return Promise.resolve(err('invalidated'));
      }
      return Promise.resolve(answer === 'cancel' ? err('cancelled') : ok(secret.slice()));
    },
    forget: vaultKey => {
      kept.delete(vaultKey);
      return Promise.resolve();
    },
  };
  return {
    deviceUnlock: createBiometricDeviceUnlock(secrets, createFakeKdf()),
    /** What the biometric store holds for a vault, as the platform would keep it. */
    kept: (vaultKey: TVaultKey) => kept.get(vaultKey),
    /** Puts a secret back as an older enrolment left it. */
    keep: (vaultKey: TVaultKey, secret: TBytes) => {
      kept.set(vaultKey, secret.slice());
    },
    answer: (next: 'yes' | 'cancel') => {
      answer = next;
    },
    enrolNewFinger: () => {
      invalidated = true;
    },
    weaken: () => {
      biometricClass = 'weak';
    },
  };
}
