import { encodePassword } from '@frozik/vault/crypto/password-normalization';
import type { TVaultKey } from '@frozik/vault/persistence/ports';
import { makeAutoObservable, runInAction } from 'mobx';

import type {
  IDeviceUnlock,
  TBiometricClass,
  TEnrolmentFailure,
  TEnrolmentKeys,
} from '../domain/ports/device-unlock';

export type TDeviceUnlockState =
  | { readonly kind: 'checking' }
  /** Only strong (Class 3) biometrics may open a vault: weak face unlock is not offered. */
  | { readonly kind: 'unavailable'; readonly biometricClass: TBiometricClass }
  | { readonly kind: 'off' }
  | { readonly kind: 'on' }
  | { readonly kind: 'failed'; readonly failure: TEnrolmentFailure };

/** This device's biometric unlock of the open vault: offered after a master-password unlock. */
export class DeviceUnlockSetup {
  state: TDeviceUnlockState = { kind: 'checking' };

  constructor(
    private readonly deviceUnlock: IDeviceUnlock,
    private readonly vaultKey: TVaultKey,
    private readonly keys: () => TEnrolmentKeys
  ) {
    makeAutoObservable<DeviceUnlockSetup, 'deviceUnlock' | 'vaultKey' | 'keys'>(
      this,
      { deviceUnlock: false, vaultKey: false, keys: false },
      { autoBind: true }
    );
  }

  async check(): Promise<void> {
    const biometricClass = await this.deviceUnlock.available();
    const enrolled =
      biometricClass === 'strong' && (await this.deviceUnlock.isEnrolled(this.vaultKey));
    runInAction(() => {
      this.state =
        biometricClass === 'strong'
          ? { kind: enrolled ? 'on' : 'off' }
          : { kind: 'unavailable', biometricClass };
    });
  }

  /** The master password once more: the session's key itself cannot be read out. */
  async switchOn(password: string): Promise<void> {
    const encoded = encodePassword(password);
    const enrolled = await this.deviceUnlock.enroll(this.vaultKey, this.keys(), encoded);
    encoded.fill(0);
    runInAction(() => {
      if (enrolled.ok) {
        this.state = { kind: 'on' };
      } else if (enrolled.error !== 'cancelled') {
        this.state = { kind: 'failed', failure: enrolled.error };
      }
    });
  }

  async switchOff(): Promise<void> {
    await this.deviceUnlock.forget(this.vaultKey);
    runInAction(() => {
      this.state = { kind: 'off' };
    });
  }
}
