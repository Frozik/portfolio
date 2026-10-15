import type { Milliseconds } from '@frozik/utils/date/types';
import type { TBytes } from '@frozik/vault/crypto/bytes';
import { utf8 } from '@frozik/vault/crypto/bytes';
import { importDek } from '@frozik/vault/crypto/dek';
import type { ISealedRecordStore, TVaultKey } from '@frozik/vault/persistence/ports';
import type { IRandom } from '@frozik/vault/ports/random';
import { createSealedJsonRecord } from '@frozik/vault/session/sealed-json-record';
import { isNil } from 'lodash-es';
import { z } from 'zod';

import { pinCode } from '@frozik/vault-app/keys/domain/quick-code';
import { reminderDue } from '@frozik/vault-app/keys/domain/reminder';
import { quickKeyOf } from '@frozik/vault-app/session/domain/quick-key';
import type { ISessionKey } from '../domain/ports';
import type { ILastMasterStore, IQuickExpiryAlarm, IQuickLockStore } from '../domain/quick-unlock';

/** A quick lock lasts this long before it becomes a full one, as the web app's default. */
export const QUICK_LIFETIME_MS = 12 * 60 * 60 * 1000;
const RECORD_KEY = 'quick-unlock';
const PEPPER_BYTES = 32;
const IV_BYTES = 12;
const HMAC: HmacImportParams = { name: 'HMAC', hash: 'SHA-256' };

const SETTING = z.object({ code: z.string(), digits: z.number().int().positive() });
type TQuickSetting = z.infer<typeof SETTING>;

export interface IExtensionQuickLockServices {
  readonly deviceConfig: ISealedRecordStore;
  readonly quickLocks: IQuickLockStore;
  readonly lastMaster: ILastMasterStore;
  readonly expiry: IQuickExpiryAlarm;
  readonly random: IRandom;
  readonly now: () => number;
}

async function peppered(pepper: TBytes, code: string): Promise<CryptoKey> {
  const hmac = await crypto.subtle.importKey('raw', pepper, HMAC, false, ['sign']);
  return quickKeyOf(new Uint8Array(await crypto.subtle.sign('HMAC', hmac, utf8(code))));
}

/**
 * The extension's quick unlock by PIN: set up under the open vault (the PIN
 * sealed with the vault's key in this browser), it turns the idle lock into
 * one that keeps the vault's key behind the PIN for one try and a lifetime.
 */
export class ExtensionQuickLock {
  constructor(private readonly services: IExtensionQuickLockServices) {}

  /** Whether the open vault has a PIN on this browser. */
  async isSetUp(key: ISessionKey): Promise<boolean> {
    return !isNil(await this.settingOf(key));
  }

  async setUp(key: ISessionKey, pin: string): Promise<boolean> {
    const code = pinCode(pin);
    if (!code.ok) {
      return false;
    }
    await (await this.record(key)).save({ code: code.value, digits: pin.length });
    return true;
  }

  async switchOff(key: ISessionKey): Promise<void> {
    await (await this.record(key)).clear();
  }

  /** At the idle lock: the key goes behind the PIN, or `false` when there is no PIN to keep it behind. */
  async lock(key: ISessionKey): Promise<boolean> {
    const setting = await this.settingOf(key);
    if (isNil(setting)) {
      return false;
    }
    const pepper = this.services.random.bytes(PEPPER_BYTES);
    const iv = this.services.random.bytes(IV_BYTES);
    const sealed = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      await peppered(pepper, setting.code),
      key.rawDek
    );
    const wrapped = new Uint8Array(IV_BYTES + sealed.byteLength);
    wrapped.set(iv);
    wrapped.set(new Uint8Array(sealed), IV_BYTES);
    await this.services.quickLocks.save({
      vaultKey: key.vaultKey,
      keyId: key.keyId,
      wrapped,
      pepper,
      digits: setting.digits,
    });
    await this.services.expiry.set(QUICK_LIFETIME_MS);
    return true;
  }

  /** What the lock screen asks for: the PIN's length, or `null` when nothing waits behind a PIN. */
  async prompt(): Promise<{ readonly digits: number } | null> {
    const record = await this.services.quickLocks.load();
    return isNil(record) ? null : { digits: record.digits };
  }

  /** The one try: the vault's key, or `null` with nothing kept. */
  async open(pin: string): Promise<ISessionKey | null> {
    const record = await this.services.quickLocks.load();
    await this.end();
    const code = pinCode(pin);
    if (isNil(record) || !code.ok) {
      return null;
    }
    try {
      const rawDek = new Uint8Array(
        await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: record.wrapped.slice(0, IV_BYTES) },
          await peppered(record.pepper, code.value),
          record.wrapped.slice(IV_BYTES)
        )
      );
      return { vaultKey: record.vaultKey, keyId: record.keyId, rawDek };
    } catch {
      return null;
    }
  }

  /** A full lock or the lifetime's end: nothing waits behind the PIN any more. */
  async end(): Promise<void> {
    await this.services.quickLocks.clear();
    await this.services.expiry.cancel();
  }

  async masterTyped(vaultKey: TVaultKey): Promise<void> {
    await this.services.lastMaster.save(vaultKey, this.services.now() as Milliseconds);
  }

  /** A week since the master password was typed: the popup asks for it, never locks. */
  async reminderDue(vaultKey: TVaultKey): Promise<boolean> {
    return reminderDue(await this.services.lastMaster.load(vaultKey), this.services.now());
  }

  private async settingOf(key: ISessionKey): Promise<TQuickSetting | null> {
    return (await this.record(key)).load();
  }

  private async record(key: ISessionKey) {
    return createSealedJsonRecord<TQuickSetting>({
      store: this.services.deviceConfig,
      vaultKey: key.vaultKey,
      recordKey: RECORD_KEY,
      dek: await importDek(key.rawDek),
      label: 'pwv/device-config',
      random: this.services.random,
      decode: value => {
        const parsed = SETTING.safeParse(value);
        return parsed.success ? parsed.data : null;
      },
    });
  }
}
