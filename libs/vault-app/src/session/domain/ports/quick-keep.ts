import type { TVaultKey } from '@frozik/vault/persistence/ports';

import type { TEnrolmentKeys } from '../../../keys/domain/ports/device-unlock';
import type { IQuickUnlockSetting, TQuickPrompt } from '../../../keys/domain/quick-code';
import type { ICustodyKey } from './key-custody';

/** Text the platform keeps encrypted at rest across restarts (the Android Keystore), one entry per vault. */
export interface IQuickKeepStore {
  read(vaultKey: TVaultKey): string | null;
  write(vaultKey: TVaultKey, text: string): void;
  remove(vaultKey: TVaultKey): void;
}

/** A quick lock kept across a restart: what its screen asks for, and until when. */
export interface IKeptQuickLock {
  readonly prompt: TQuickPrompt;
  readonly expiresAt: number;
}

/**
 * The vault's key kept behind the quick code across restarts, as password managers keep a PIN: a
 * platform whose process the system ends at will (a phone) would otherwise ask for the master
 * password after every return. Only a master-password unlock can read the key to keep.
 */
export interface IQuickKeep {
  arm(
    vaultKey: TVaultKey,
    keys: TEnrolmentKeys,
    password: string,
    setting: IQuickUnlockSetting,
    now: number
  ): Promise<void>;
  /** The kept lock still within its lifetime; an expired or unreadable one is dropped. */
  kept(vaultKey: TVaultKey, now: number): IKeptQuickLock | null;
  /** A quick lock now: the lifetime runs from here. */
  touch(vaultKey: TVaultKey, lifetimeMs: number, now: number): void;
  /** The one try: the key, or `null` with nothing kept. */
  open(vaultKey: TVaultKey, canonicalCode: string): Promise<ICustodyKey | null>;
  forget(vaultKey: TVaultKey): void;
}
