import type { Milliseconds } from '@frozik/utils/date/types';
import { fromHexBytes, toHex } from '@frozik/vault/crypto/bytes';
import { isNil } from 'lodash-es';
import { browser } from 'wxt/browser';
import { z } from 'zod';

import type { ILastMasterStore, IQuickExpiryAlarm, IQuickLockStore } from '../domain/quick-unlock';

const QUICK_LOCK = 'quick-lock';
const LAST_MASTER = 'last-master-at';
export const QUICK_EXPIRY_ALARM = 'quick-lock-expiry';
const MS_PER_MINUTE = 60_000;

const STORED = z.object({
  vaultKey: z.string(),
  keyId: z.string(),
  wrapped: z.string(),
  pepper: z.string(),
  digits: z.number(),
});

/** Beside the session's key, in memory that a restart or an update wipes, closed to pages. */
export const CHROME_QUICK_LOCKS: IQuickLockStore = {
  async load() {
    const stored = STORED.safeParse((await browser.storage.session.get(QUICK_LOCK))[QUICK_LOCK]);
    if (!stored.success) {
      return null;
    }
    const [keyId, wrapped, pepper] = [
      stored.data.keyId,
      stored.data.wrapped,
      stored.data.pepper,
    ].map(fromHexBytes);
    return isNil(keyId) || isNil(wrapped) || isNil(pepper)
      ? null
      : { vaultKey: stored.data.vaultKey, keyId, wrapped, pepper, digits: stored.data.digits };
  },
  async save({ vaultKey, keyId, wrapped, pepper, digits }) {
    await browser.storage.session.set({
      [QUICK_LOCK]: {
        vaultKey,
        keyId: toHex(keyId),
        wrapped: toHex(wrapped),
        pepper: toHex(pepper),
        digits,
      },
    });
  },
  async clear() {
    await browser.storage.session.remove(QUICK_LOCK);
  },
};

const LAST_MASTER_RECORD = z.record(z.string(), z.number());

/** When the master password was last typed, per vault, across restarts. */
export const CHROME_LAST_MASTER: ILastMasterStore = {
  async load(vaultKey) {
    const stored = LAST_MASTER_RECORD.safeParse(
      (await browser.storage.local.get(LAST_MASTER))[LAST_MASTER]
    );
    const at = stored.success ? stored.data[vaultKey] : undefined;
    return isNil(at) ? null : (at as Milliseconds);
  },
  async save(vaultKey, at) {
    const stored = LAST_MASTER_RECORD.safeParse(
      (await browser.storage.local.get(LAST_MASTER))[LAST_MASTER]
    );
    await browser.storage.local.set({
      [LAST_MASTER]: { ...(stored.success ? stored.data : {}), [vaultKey]: at },
    });
  },
};

export const CHROME_QUICK_EXPIRY: IQuickExpiryAlarm = {
  async set(delayMs) {
    await browser.alarms.create(QUICK_EXPIRY_ALARM, { delayInMinutes: delayMs / MS_PER_MINUTE });
  },
  async cancel() {
    await browser.alarms.clear(QUICK_EXPIRY_ALARM);
  },
};
