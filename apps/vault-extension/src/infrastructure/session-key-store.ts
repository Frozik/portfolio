import { fromHexBytes, toHex } from '@frozik/vault/crypto/bytes';
import { isNil } from 'lodash-es';
import { browser } from 'wxt/browser';
import { z } from 'zod';

import type { IProtectedWindow, ISessionKeyStore } from '../domain/ports';

const KEY = 'session-key';
const PROTECTED_UNTIL = 'protected-open-until';

const STORED_SCHEMA = z.object({ vaultKey: z.string(), rawDek: z.string(), keyId: z.string() });

/**
 * `chrome.storage.session`: in memory, gone with a browser
 * restart and an extension update or reload; closed to content scripts.
 */
export const CHROME_SESSION_KEYS: ISessionKeyStore = {
  async load() {
    const stored = STORED_SCHEMA.safeParse((await browser.storage.session.get(KEY))[KEY]);
    if (!stored.success) {
      return null;
    }
    const rawDek = fromHexBytes(stored.data.rawDek);
    const keyId = fromHexBytes(stored.data.keyId);
    return isNil(rawDek) || isNil(keyId) ? null : { vaultKey: stored.data.vaultKey, rawDek, keyId };
  },
  async save({ vaultKey, rawDek, keyId }) {
    await browser.storage.session.set({
      [KEY]: { vaultKey, rawDek: toHex(rawDek), keyId: toHex(keyId) },
    });
  },
  async clear() {
    await browser.storage.session.remove(KEY);
  },
};

/** Content scripts never read the session store; set once at every start of the worker. */
export function closeSessionStoreToPages(): Promise<void> {
  return browser.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_CONTEXTS' });
}

/** Until when protected cards are open, beside the session's key. */
export const CHROME_PROTECTED_WINDOW: IProtectedWindow = {
  async load() {
    const stored: unknown = (await browser.storage.session.get(PROTECTED_UNTIL))[PROTECTED_UNTIL];
    return typeof stored === 'number' ? stored : 0;
  },
  async save(until) {
    await browser.storage.session.set({ [PROTECTED_UNTIL]: until });
  },
};
