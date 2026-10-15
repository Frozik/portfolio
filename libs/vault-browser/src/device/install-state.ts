/** How the app runs: installed (its own storage, kept while used), or in an iPhone's browser tab. */
export type TInstallState = 'installed' | 'iphone-browser' | 'browser';

const STANDALONE = '(display-mode: standalone)';
/** iPadOS presents itself as a Mac; touch points tell them apart. */
const IPAD_AS_MAC = /Macintosh/;

/**
 * Safari erases a tab's site data after a week without a visit, and a Home
 * Screen app keeps its own storage apart from the tab — so on an iPhone or
 * iPad the vault belongs in the installed app from the first run.
 */
export function installStateOf({
  userAgent,
  maxTouchPoints,
  standalone,
  displayModeStandalone,
}: {
  readonly userAgent: string;
  readonly maxTouchPoints: number;
  /** Safari's own flag for a Home Screen app. */
  readonly standalone: boolean;
  readonly displayModeStandalone: boolean;
}): TInstallState {
  if (standalone || displayModeStandalone) {
    return 'installed';
  }
  const apple =
    /iPhone|iPad|iPod/.test(userAgent) || (IPAD_AS_MAC.test(userAgent) && maxTouchPoints > 1);
  return apple ? 'iphone-browser' : 'browser';
}

/** This page's install state, read once at start. */
export function currentInstallState(): TInstallState {
  return installStateOf({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone: Reflect.get(navigator, 'standalone') === true,
    displayModeStandalone: window.matchMedia(STANDALONE).matches,
  });
}
