import { openDB } from 'idb';
import { isNil } from 'lodash-es';

import type { ICachedDirectory } from '@frozik/vault-http/audit/two-factor-directory';
import { twoFactorDirectoryLoader } from '@frozik/vault-http/audit/two-factor-directory';

const DATABASE = 'pwv:2fa-directory';
const STORE = 'directory';
const ENTRY = 'totp';

function isCachedDirectory(value: unknown): value is ICachedDirectory {
  return typeof value === 'object' && !isNil(value) && 'fetchedAtMs' in value && 'json' in value;
}

const database = () =>
  openDB(DATABASE, 1, {
    upgrade: db => {
      db.createObjectStore(STORE);
    },
  });

/** The directory kept in IndexedDB between visits. */
export const loadTwoFactorDirectory = twoFactorDirectoryLoader({
  read: async () => {
    const cached: unknown = await (await database()).get(STORE, ENTRY);
    return isCachedDirectory(cached) ? cached : null;
  },
  write: async entry => {
    await (await database()).put(STORE, entry, ENTRY);
  },
});
