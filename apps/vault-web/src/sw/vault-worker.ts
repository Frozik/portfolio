import { isActivateWaitingWorker } from '@frozik/vault-browser/release/service-worker-protocol';
import { setCacheNameDetails } from 'workbox-core';
import type { PrecacheEntry } from 'workbox-precaching';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

/** Unique on a shared origin: no other app's cleanup takes these caches. */
const CACHE_PREFIX = 'ciphra-vault';

/**
 * The whole build is precached at install, so the app opens offline from its
 * first visit. A new build waits until the page lets it take over — at launch
 * or while fully locked — and claims the page only then.
 */
export function installVaultWorker(
  worker: ServiceWorkerGlobalScope,
  precacheManifest: readonly (PrecacheEntry | string)[]
): void {
  setCacheNameDetails({ prefix: CACHE_PREFIX });
  precacheAndRoute([...precacheManifest]);
  cleanupOutdatedCaches();
  registerRoute(
    new NavigationRoute(createHandlerBoundToURL('/index.html'), {
      // Static pages of the site open as themselves, not as the app.
      denylist: [/^\/privacy\.html$/],
    })
  );

  worker.addEventListener('message', event => {
    if (isActivateWaitingWorker(event.data)) {
      void worker.skipWaiting();
    }
  });
  worker.addEventListener('activate', event => {
    event.waitUntil(worker.clients.claim());
  });
}
