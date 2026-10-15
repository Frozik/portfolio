/**
 * The emergency build: deployed in place of the app's worker, it takes over at
 * once, deletes every cache, unregisters itself and reloads each open window
 * from the network — a broken or compromised build leaves no installed copy.
 */
export function retireEveryCopy(worker: ServiceWorkerGlobalScope): void {
  worker.addEventListener('install', () => {
    void worker.skipWaiting();
  });
  worker.addEventListener('activate', event => {
    event.waitUntil(
      (async () => {
        const names = await caches.keys();
        await Promise.all(names.map(name => caches.delete(name)));
        await worker.registration.unregister();
        const windows = await worker.clients.matchAll({ type: 'window' });
        await Promise.all(windows.map(window => window.navigate(window.url)));
      })()
    );
  });
}
