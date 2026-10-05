import { isNil } from 'lodash-es';

import { UpdateBanner } from './updateBanner';

const UPDATE_BANNER_DISPLAY_MS = 2_000;

const SW_UPDATE_CHECK_INTERVAL_MS = 60_000;

/** Set right before a reload that should cure a missing chunk; the next start reads and clears it. */
const STALE_BUILD_RELOAD_KEY = 'stale-build-reload';

export function setupServiceWorkerUpdate(): void {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  const banner = new UpdateBanner();
  const reloadedForStaleBuild = consumeStaleBuildReload();
  let reloading = false;
  const reload = (): void => {
    if (reloading) {
      return;
    }
    reloading = true;
    banner.show();
    setTimeout(() => window.location.reload(), UPDATE_BANNER_DISPLAY_MS);
  };

  // `clientsClaim()` also fires `controllerchange` on the very first install,
  // when there is nothing to update — reloading there would restart every first
  // visit. Only that first claim of an uncontrolled page is skipped: a later
  // change, however long the tab stayed open, is a real update.
  let awaitingFirstClaim = navigator.serviceWorker.controller === null;
  let stale = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (awaitingFirstClaim && !stale) {
      awaitingFirstClaim = false;
      return;
    }
    reload();
  });

  // A deployment removes the previous build's files from the server, so a
  // page still running that build fails to load its next lazy chunk. The new
  // build is what cures it: wait for the worker that brings it, or reload once
  // if it is already here — the listener above may have been attached after
  // its `controllerchange`. A failure the reload did not cure (offline without
  // the pack) is left to the error page instead of reloading in a loop.
  const reloadOnceForStaleBuild = (): void => {
    if (reloadedForStaleBuild || !rememberStaleBuildReload()) {
      banner.hide();
      return;
    }
    reload();
  };
  window.addEventListener('vite:preloadError', () => {
    if (stale || reloading) {
      return;
    }
    stale = true;
    banner.show();
    void navigator.serviceWorker.getRegistration().then(async registration => {
      await registration?.update().catch(() => undefined);
      const incoming = registration?.installing ?? registration?.waiting;
      if (isNil(incoming)) {
        reloadOnceForStaleBuild();
        return;
      }
      incoming.addEventListener('statechange', () => {
        if (incoming.state === 'redundant') {
          reloadOnceForStaleBuild();
        }
      });
    });
  });

  navigator.serviceWorker.ready.then(registration => {
    const checkForUpdate = () => {
      if (navigator.onLine === false) {
        return;
      }
      registration.update().catch(() => undefined);
    };

    setInterval(checkForUpdate, SW_UPDATE_CHECK_INTERVAL_MS);

    // Safari throttles interval timers in background tabs and freezes pages
    // entirely in iOS standalone mode, so the interval alone can leave a
    // returning user on a stale build for a long time. Returning to the tab
    // (visibilitychange) and restoring from the back-forward cache (pageshow
    // with `persisted`) are exactly the moments a stale page resurfaces —
    // check immediately on both.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        checkForUpdate();
      }
    });
    window.addEventListener('pageshow', event => {
      if (event.persisted) {
        checkForUpdate();
      }
    });
  });
}

function consumeStaleBuildReload(): boolean {
  try {
    const reloaded = sessionStorage.getItem(STALE_BUILD_RELOAD_KEY) !== null;
    sessionStorage.removeItem(STALE_BUILD_RELOAD_KEY);
    return reloaded;
  } catch {
    return false;
  }
}

/** Without session storage there is no loop guard, so the caller must not reload. */
function rememberStaleBuildReload(): boolean {
  try {
    sessionStorage.setItem(STALE_BUILD_RELOAD_KEY, '1');
    return true;
  } catch {
    return false;
  }
}
