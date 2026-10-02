import { isRunningInstalled, onAppInstalled } from './installedPwa';
import type { IOfflinePackPort } from './offlinePackPort';
import { OfflinePackStore } from './OfflinePackStore';

/**
 * Installing the app is the visitor's signal that it should work without a
 * network: the pack downloads on install and is topped up on every launch
 * from the icon, so a deployment in between never leaves a route uncached. A
 * browser tab never downloads it unasked — the menu offers it as a button.
 */
export function bootstrapOfflinePack(port: IOfflinePackPort): OfflinePackStore {
  const store = new OfflinePackStore(port, isRunningInstalled());
  if (store.automatic) {
    store.download();
  }
  onAppInstalled(store.markInstalled);
  return store;
}
