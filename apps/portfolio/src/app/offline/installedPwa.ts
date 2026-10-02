const STANDALONE_DISPLAY_MODE = '(display-mode: standalone)';

/** Whether this page was launched from the installed app (home screen, dock, start menu) rather than a browser tab. */
export function isRunningInstalled(): boolean {
  return window.matchMedia(STANDALONE_DISPLAY_MODE).matches || isIosStandalone();
}

// iOS Safari predates the display-mode media feature and reports installed mode on `navigator` only.
function isIosStandalone(): boolean {
  return 'standalone' in navigator && navigator.standalone === true;
}

/** Chromium fires this in the browser tab the moment the visitor accepts the install prompt; Safari has no equivalent. */
export function onAppInstalled(listener: () => void): () => void {
  window.addEventListener('appinstalled', listener);
  return () => window.removeEventListener('appinstalled', listener);
}
