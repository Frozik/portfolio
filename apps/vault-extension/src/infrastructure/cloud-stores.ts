import type { IStorageProvider } from '@frozik/cloud-storage/core/storage-provider';
import { withRetry } from '@frozik/cloud-storage/core/with-retry';
import { createWebDavProvider } from '@frozik/cloud-storage/webdav/webdav-provider';
import { createWebDavTransport } from '@frozik/cloud-storage/webdav/webdav-transport';
import { ok } from '@frozik/utils/result/result';
import { fromHexBytes, toHex } from '@frozik/vault/crypto/bytes';
import type { ISealedRecordStore } from '@frozik/vault/persistence/ports';
import { browser } from 'wxt/browser';

import type { IWebDavSource } from '../domain/cloud';
import { CLOUD_LINK_SCHEMA } from '../domain/cloud';
import type { IPendingCloudLink, ISyncAlarm } from '../domain/ports';

/** The extension only reads: no write needs the server's compare-and-swap. */
const READ_ONLY_FEATURES = {
  conditionalRequests: false,
  moveReplace: false,
  revisionKind: 'etag',
} as const;
export const SYNC_ALARM = 'pull';
/** A pull this often while unlocked. */
const SYNC_EVERY_MINUTES = 15;
const PENDING_LINK = 'pending-cloud-link';

/** The host was granted at setup, so the extension reads the folder without CORS. */
export function openWebDav(source: IWebDavSource, password: string): IStorageProvider {
  return withRetry(
    createWebDavProvider({
      transport: createWebDavTransport({
        endpoint: source.folderUrl,
        username: source.username,
        password,
      }),
      features: READ_ONLY_FEATURES,
    })
  );
}

function recordKey(vaultKey: string, key: string): string {
  return `sealed:${vaultKey}:${key}`;
}

/** Sealed records of this browser, in `storage.local`: bytes kept as hex. */
export const CHROME_DEVICE_CONFIG: ISealedRecordStore = {
  async get(vaultKey, key) {
    const stored: unknown = (await browser.storage.local.get(recordKey(vaultKey, key)))[
      recordKey(vaultKey, key)
    ];
    return ok(typeof stored === 'string' ? fromHexBytes(stored) : null);
  },
  async put(vaultKey, key, sealed) {
    await browser.storage.local.set({ [recordKey(vaultKey, key)]: toHex(sealed) });
    return ok(undefined);
  },
  async delete(vaultKey, key) {
    await browser.storage.local.remove(recordKey(vaultKey, key));
    return ok(undefined);
  },
  async keys(vaultKey) {
    const prefix = recordKey(vaultKey, '');
    const all = await browser.storage.local.get(null);
    return ok(
      Object.keys(all)
        .filter(key => key.startsWith(prefix))
        .map(key => key.slice(prefix.length))
    );
  },
};

/** The link given at setup, in `storage.session` until an unlock seals it: a browser restart forgets it. */
export const CHROME_PENDING_CLOUD_LINK: IPendingCloudLink = {
  async load() {
    const parsed = CLOUD_LINK_SCHEMA.safeParse(
      (await browser.storage.session.get(PENDING_LINK))[PENDING_LINK]
    );
    return parsed.success ? parsed.data : null;
  },
  async save(link) {
    await browser.storage.session.set({ [PENDING_LINK]: link });
  },
  async clear() {
    await browser.storage.session.remove(PENDING_LINK);
  },
};

export const CHROME_SYNC_ALARM: ISyncAlarm = {
  async start() {
    await browser.alarms.create(SYNC_ALARM, { periodInMinutes: SYNC_EVERY_MINUTES });
  },
  async stop() {
    await browser.alarms.clear(SYNC_ALARM);
  },
};
