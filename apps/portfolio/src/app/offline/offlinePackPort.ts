import { isNil } from 'lodash-es';

import type { TOfflinePackRequest, TOfflinePackStatus } from '../../sw/offline-pack-protocol';
import {
  isOfflinePackStatusMessage,
  OFFLINE_PACK_QUERY,
  OFFLINE_PACK_WARM,
} from '../../sw/offline-pack-protocol';

/** The page's view of the worker that owns the offline pack. */
export interface IOfflinePackPort {
  requestWarm(): void;
  requestStatus(): void;
  subscribe(listener: (status: TOfflinePackStatus) => void): () => void;
}

/**
 * Talks to the registered service worker. Without one (dev server, an
 * unsupported browser) requests go nowhere and no status ever arrives, which
 * the store shows as "unknown" rather than as a broken download.
 */
export function createServiceWorkerOfflinePackPort(): IOfflinePackPort {
  const container = 'serviceWorker' in navigator ? navigator.serviceWorker : undefined;

  const post = (request: TOfflinePackRequest): void => {
    void container?.ready.then(registration => registration.active?.postMessage(request));
  };

  return {
    requestWarm() {
      requestPersistentStorage();
      post({ type: OFFLINE_PACK_WARM });
    },
    requestStatus() {
      post({ type: OFFLINE_PACK_QUERY });
    },
    subscribe(listener) {
      if (isNil(container)) {
        return () => undefined;
      }
      const handleMessage = (event: MessageEvent<unknown>): void => {
        if (isOfflinePackStatusMessage(event.data)) {
          listener(event.data.status);
        }
      };
      container.addEventListener('message', handleMessage);
      return () => container.removeEventListener('message', handleMessage);
    },
  };
}

// A persistent bucket keeps the pack from being evicted under storage pressure
// before the flight. Safari exposes `navigator.storage` without `persist`.
function requestPersistentStorage(): void {
  const storage: Partial<StorageManager> | undefined = navigator.storage;
  void storage?.persist?.();
}
