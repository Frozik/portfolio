const UPDATE_BANNER_DISPLAY_MS = 2_000;

const SW_UPDATE_CHECK_INTERVAL_MS = 60_000;

const GEAR_SVG =
  '<svg class="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" ' +
  'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
  '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08' +
  'a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 ' +
  '1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25' +
  'a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25' +
  'a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 ' +
  '0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73' +
  'l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>' +
  '<circle cx="12" cy="12" r="3"/></svg>';

// The banner is raised before React mounts (the page is about to reload), so it
// is built with plain DOM APIs from a static, non-user-controlled SVG string.
function showUpdateBanner(): void {
  const banner = document.createElement('div');
  banner.className =
    'fixed inset-x-0 top-0 z-[99999] flex items-center justify-center gap-2 ' +
    'py-3 text-sm font-sans bg-surface-elevated/95 text-text ' +
    'border-b border-brand-500/30 backdrop-blur-md shadow-lg animate-slide-in-top';
  banner.innerHTML = `${GEAR_SVG}<span>Updating…</span>`;
  document.body.appendChild(banner);
}

export function setupServiceWorkerUpdate(): void {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  // Workbox's `clientsClaim()` also fires `controllerchange` on the very first
  // install, when there is nothing to update — reloading there would restart
  // every first visit. Only a page that was already controlled is a real update.
  const wasControlled = navigator.serviceWorker.controller !== null;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!wasControlled || reloading) {
      return;
    }
    reloading = true;
    showUpdateBanner();
    setTimeout(() => window.location.reload(), UPDATE_BANNER_DISPLAY_MS);
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
