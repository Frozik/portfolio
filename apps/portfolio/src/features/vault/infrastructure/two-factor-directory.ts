import { twoFactorDomainsOf } from '@frozik/vault/audit/two-factor-directory';
import { openDB } from 'idb';
import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

import type { TLoadTwoFactorDirectory } from '../domain/ports/audit-sources';

const DIRECTORY_URL = 'https://api.2fa.directory/v4/totp.json';
const DATABASE = 'pwv:2fa-directory';
const STORE = 'directory';
const ENTRY = 'totp';
/** The list changes slowly; a week-old copy is good enough. */
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;

interface ICachedDirectory {
  readonly fetchedAtMs: number;
  readonly json: unknown;
}

function isCachedDirectory(value: unknown): value is ICachedDirectory {
  return typeof value === 'object' && !isNil(value) && 'fetchedAtMs' in value && 'json' in value;
}

const nowMs = (): number => Temporal.Now.instant().epochMilliseconds;

const database = () =>
  openDB(DATABASE, 1, {
    upgrade: db => {
      db.createObjectStore(STORE);
    },
  });

/**
 * 2FA Directory (MIT, "Data sourced from 2FA Directory by
 * 2factorauth"): fetched at most weekly and kept in IndexedDB. It names
 * sites only, so nothing about the vault leaves the page.
 */
export const loadTwoFactorDirectory: TLoadTwoFactorDirectory = async signal => {
  const db = await database().catch(() => null);
  const cached: unknown = await db?.get(STORE, ENTRY).catch(() => null);
  if (isCachedDirectory(cached) && nowMs() - cached.fetchedAtMs < KEEP_MS) {
    return twoFactorDomainsOf(cached.json);
  }
  try {
    const response = await fetch(DIRECTORY_URL, { signal });
    if (!response.ok) {
      return isCachedDirectory(cached) ? twoFactorDomainsOf(cached.json) : null;
    }
    const json: unknown = await response.json();
    await db?.put(STORE, { fetchedAtMs: nowMs(), json } satisfies ICachedDirectory, ENTRY);
    return twoFactorDomainsOf(json);
  } catch {
    return isCachedDirectory(cached) ? twoFactorDomainsOf(cached.json) : null;
  }
};
