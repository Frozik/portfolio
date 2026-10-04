import { assertNever } from '@frozik/utils/assert/assertNever';
import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';

import { OfflinePack } from './offline-pack';
import { OfflinePackOptIn } from './offline-pack-opt-in';
import type { IOfflinePackStatusMessage, TOfflinePackStatus } from './offline-pack-protocol';
import {
  isOfflinePackRequest,
  OFFLINE_PACK_QUERY,
  OFFLINE_PACK_STATUS,
  OFFLINE_PACK_WARM,
} from './offline-pack-protocol';

declare let self: ServiceWorkerGlobalScope;

const BASE = import.meta.env.BASE_URL;
/** Hashed assets are immutable: once cached, a URL never needs the network again. */
const HASHED_ASSETS_CACHE = 'hashed-assets';
const OFFLINE_PACK_OPT_IN_CACHE = 'offline-pack-opt-in';
/** The previous worker generation's expiration bookkeeping; nothing reads it any more. */
const LEGACY_EXPIRATION_DATABASE = 'workbox-expiration';

// Without these a new worker waits until every tab closes and the page's
// `controllerchange` reload never fires.
self.skipWaiting();
clientsClaim();

const precacheManifest = self.__WB_MANIFEST;
precacheAndRoute(precacheManifest);
cleanupOutdatedCaches();

// Hosts answer asset requests with `Vary: Origin`, and a module `import()` sends
// an `Origin` header the pack download did not — without `ignoreVary` the entry
// the worker just stored is a miss, and the route fails offline.
registerRoute(
  ({ url }) => url.pathname.startsWith(`${BASE}assets/`),
  new CacheFirst({ cacheName: HASHED_ASSETS_CACHE, matchOptions: { ignoreVary: true } })
);
registerRoute(
  new NavigationRoute(createHandlerBoundToURL(`${BASE}index.html`), {
    allowlist: [new RegExp(`^${BASE}`)],
    // StreamSaver's `mitm.html` is loaded before its own worker exists; answering it with the shell would break every streamed download.
    denylist: [/\.pdf$/, /\/stream-saver\//],
  })
);

const precachedUrls = new Set(
  precacheManifest.map(entry => (typeof entry === 'string' ? entry : entry.url))
);
const offlinePack = new OfflinePack(
  new Set(
    __BUILD_ASSETS__
      .filter(asset => !precachedUrls.has(asset))
      .map(asset => new URL(asset, self.location.href).href)
  ),
  () => caches.open(HASHED_ASSETS_CACHE),
  publishStatus
);
const optIn = new OfflinePackOptIn(`${self.registration.scope}offline-pack`, () =>
  caches.open(OFFLINE_PACK_OPT_IN_CACHE)
);

// A page asks for the status before this worker controls it (first visit, or
// a tab that was open through an update), so uncontrolled windows are included.
async function publishStatus(status: TOfflinePackStatus): Promise<void> {
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of windows) {
    sendStatus(client, status);
  }
}

function sendStatus(client: Client, status: TOfflinePackStatus): void {
  const message: IOfflinePackStatusMessage = { type: OFFLINE_PACK_STATUS, status };
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- Client.postMessage takes transferables, not an origin
  client.postMessage(message);
}

// A new build downloads its pack while installing, so the switch to it never
// leaves a visitor who had the pack without one — not even between activation
// and the page's reload.
self.addEventListener('install', event => {
  event.waitUntil(
    optIn.isRemembered().then(remembered => (remembered ? offlinePack.warm() : undefined))
  );
});

self.addEventListener('activate', event => {
  indexedDB.deleteDatabase(LEGACY_EXPIRATION_DATABASE);
  event.waitUntil(offlinePack.dropForeignAssets());
});

self.addEventListener('message', event => {
  if (!isOfflinePackRequest(event.data)) {
    return;
  }
  switch (event.data.type) {
    case OFFLINE_PACK_WARM:
      event.waitUntil(Promise.all([optIn.remember(), offlinePack.warm()]));
      return;
    case OFFLINE_PACK_QUERY: {
      const { source } = event;
      if (source instanceof Client) {
        event.waitUntil(offlinePack.status().then(status => sendStatus(source, status)));
      }
      return;
    }
    default:
      assertNever(event.data);
  }
});
