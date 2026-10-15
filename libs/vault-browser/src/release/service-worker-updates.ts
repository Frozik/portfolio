import { onWorkerTakeover } from '@frozik/utils/service-worker/worker-takeover';
import { isNil } from 'lodash-es';

import type { IActivateWaitingWorker } from './service-worker-protocol';
import { ACTIVATE_WAITING_WORKER } from './service-worker-protocol';

export interface IServiceWorkerUpdates {
  /** Whether this page holds no key now, so a new build may replace it. */
  allowActivation(allowed: boolean): void;
  /** Asks the server for a newer worker. */
  check(): void;
  dispose(): void;
}

const ACTIVATE: IActivateWaitingWorker = { type: ACTIVATE_WAITING_WORKER };

/**
 * Held, shared, by every page of the app that holds a key: a new worker takes
 * over all pages at once, so it may only be let in when no page holds one.
 */
const KEY_HELD_LOCK = 'ciphra-vault:key-held';

const NO_UPDATES: IServiceWorkerUpdates = {
  allowActivation: () => undefined,
  check: () => undefined,
  dispose: () => undefined,
};

/** This page's share of the key-held lock; `release` lets it go. */
function holdKeyLock(): () => void {
  let release: () => void = () => undefined;
  const held = new Promise<void>(resolve => {
    release = resolve;
  });
  void navigator.locks.request(KEY_HELD_LOCK, { mode: 'shared' }, () => held);
  return release;
}

/** Runs `post` only while no page holds the key-held lock. */
function whenNoPageHoldsAKey(post: () => void): void {
  void navigator.locks.request(KEY_HELD_LOCK, { mode: 'exclusive', ifAvailable: true }, lock => {
    if (!isNil(lock)) {
      post();
    }
  });
}

/**
 * Registers the app's worker. A new build installs and waits; it takes over
 * only when no page of the app holds a key — at launch or behind a full lock
 * in every tab — and each page then reloads into it, so a deploy never swaps
 * the code under an open vault nor turns a quick lock into a full one.
 */
export function registerServiceWorker(
  scriptUrl: string,
  /** How a page reloads into the new build: it may keep what its unlock screen should say. */
  reload: () => void
): IServiceWorkerUpdates {
  if (!('serviceWorker' in navigator) || !('locks' in navigator)) {
    return NO_UPDATES;
  }
  let releaseKeyLock: (() => void) | null = null;
  let registration: ServiceWorkerRegistration | null = null;
  const activateIfAllowed = (): void => {
    const waiting = registration?.waiting;
    if (isNil(releaseKeyLock) && !isNil(waiting)) {
      // oxlint-disable-next-line unicorn/require-post-message-target-origin -- ServiceWorker.postMessage takes transferables, not an origin
      whenNoPageHoldsAKey(() => waiting.postMessage(ACTIVATE));
    }
  };
  const followInstalling = (worker: ServiceWorker | null): void => {
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed') {
        activateIfAllowed();
      }
    });
  };

  const stopFollowingTakeovers = onWorkerTakeover(navigator.serviceWorker, ({ firstClaim }) => {
    if (!firstClaim) {
      reload();
    }
  });
  void navigator.serviceWorker.register(scriptUrl).then(registered => {
    registration = registered;
    followInstalling(registered.installing);
    registered.addEventListener('updatefound', () => followInstalling(registered.installing));
    activateIfAllowed();
  });

  return {
    allowActivation(allowed) {
      if (allowed) {
        releaseKeyLock?.();
        releaseKeyLock = null;
        activateIfAllowed();
      } else {
        releaseKeyLock ??= holdKeyLock();
      }
    },
    check() {
      if (!isNil(registration)) {
        registration.update().catch(() => undefined);
      }
      activateIfAllowed();
    },
    dispose() {
      stopFollowingTakeovers();
      releaseKeyLock?.();
      releaseKeyLock = null;
    },
  };
}
