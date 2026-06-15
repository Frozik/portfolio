import type { ReactElement } from 'react';
import { useEffect } from 'react';

import { YANDEX_OAUTH_MESSAGE } from './YandexOidcProvider';

/**
 * Static HTML used to live at `public/oauth/yandex/callback.html`, but
 * Yandex OAuth Console URIs were registered without an `.html`
 * extension. To keep the registered URIs as-is we now mount this React
 * route at `/oauth/yandex/callback` — VitePWA's `navigateFallback`
 * returns the SPA bundle, the router matches this component, the
 * effect parses the OAuth fragment, posts it to the opener, and
 * closes the popup.
 *
 * The component renders nothing visible past the brief "Signing you
 * in…" hint — popups close themselves before the user reads it. The
 * effect runs once on mount; double-execution under React 19 strict
 * mode is a no-op (`opener` is null in the second run after the first
 * one closed the window).
 */
export function YandexOauthCallbackPage(): ReactElement {
  useEffect(() => {
    const openerWindow = window.opener as Window | null;
    if (openerWindow === null) {
      return;
    }
    const fragment = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(fragment);
    const accessToken = params.get('access_token') ?? '';
    const state = params.get('state') ?? '';
    const error = params.get('error') ?? '';
    const payload: { type: string; accessToken: string; state: string; error?: string } = {
      type: YANDEX_OAUTH_MESSAGE,
      accessToken,
      state,
    };
    if (error.length > 0) {
      payload.error = error;
    }
    // Drop the implicit-flow `access_token` from the URL before anything else, so
    // it doesn't linger in the popup's history/address bar (XSS-reachable).
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    try {
      // Hard-pinned target origin — never `'*'`. The opener double-
      // checks `event.origin === window.location.origin` for symmetry.
      openerWindow.postMessage(payload, window.location.origin);
    } catch {
      // Opener already closed / cross-origin restriction — nothing
      // recoverable; the watchdog timer in the opener will resolve
      // null when the popup closes.
    }
    window.close();
  }, []);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#07090c] p-4 text-center text-sm text-text-muted">
      Signing you in…
    </main>
  );
}
