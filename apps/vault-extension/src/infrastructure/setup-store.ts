import { browser } from 'wxt/browser';
import { z } from 'zod';

import type { ISetupStore } from '../domain/ports';

const KEY = 'setup';
const SETUP_SCHEMA = z.object({
  vaultKey: z.string(),
  name: z.string(),
  cloudRev: z.string().nullable().default(null),
});

/** Which vault the extension keeps, by name only, in `storage.local`; a field it is handed beyond those is never written. */
export const CHROME_SETUP: ISetupStore = {
  async load() {
    const parsed = SETUP_SCHEMA.safeParse((await browser.storage.local.get(KEY))[KEY]);
    return parsed.success ? parsed.data : null;
  },
  async save({ vaultKey, name, cloudRev }) {
    await browser.storage.local.set({ [KEY]: { vaultKey, name, cloudRev } });
  },
  async clear() {
    await browser.storage.local.remove(KEY);
  },
};
