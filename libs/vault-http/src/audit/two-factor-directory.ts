import { twoFactorDomainsOf } from '@frozik/vault/audit/two-factor-directory';
import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

import type { TLoadTwoFactorDirectory } from '@frozik/vault-app/audit/domain/ports/audit-sources';

const DIRECTORY_URL = 'https://api.2fa.directory/v4/totp.json';
/** The list changes slowly; a week-old copy is good enough. */
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;

export interface ICachedDirectory {
  readonly fetchedAtMs: number;
  readonly json: unknown;
}

/** Where a platform keeps the last copy; either call may fail, and the loader goes on without it. */
export interface IDirectoryCache {
  read(): Promise<ICachedDirectory | null>;
  write(entry: ICachedDirectory): Promise<void>;
}

const nowMs = (): number => Temporal.Now.instant().epochMilliseconds;

/**
 * 2FA Directory (MIT, "Data sourced from 2FA Directory by 2factorauth"):
 * fetched at most weekly. It names sites only, so nothing about the vault
 * leaves the device.
 */
export function twoFactorDirectoryLoader(cache: IDirectoryCache): TLoadTwoFactorDirectory {
  return async signal => {
    const cached = await cache.read().catch(() => null);
    if (!isNil(cached) && nowMs() - cached.fetchedAtMs < KEEP_MS) {
      return twoFactorDomainsOf(cached.json);
    }
    const fallback = isNil(cached) ? null : twoFactorDomainsOf(cached.json);
    try {
      const response = await fetch(DIRECTORY_URL, { signal });
      if (!response.ok) {
        return fallback;
      }
      const json: unknown = await response.json();
      await cache.write({ fetchedAtMs: nowMs(), json }).catch(() => undefined);
      return twoFactorDomainsOf(json);
    } catch {
      return fallback;
    }
  };
}

/** A copy for as long as the process lives: a phone asks again after each start. */
export function memoryDirectoryCache(): IDirectoryCache {
  let kept: ICachedDirectory | null = null;
  return {
    read: () => Promise.resolve(kept),
    write: entry => {
      kept = entry;
      return Promise.resolve();
    },
  };
}
