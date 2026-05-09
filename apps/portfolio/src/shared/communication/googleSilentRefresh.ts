/**
 * Silent ID-token refresh against Google Identity Services.
 *
 * Browser-side Google sign-in does NOT issue a refresh token (the only
 * way to get one is the server-side authorization-code flow with a
 * client secret — unsafe to embed in a SPA). To extend the session
 * without UI, GIS exposes a "silent" path:
 *  - `google.accounts.id.initialize({ auto_select: true,
 *    use_fedcm_for_prompt: true, login_hint })`,
 *  - `google.accounts.id.prompt(notification => ...)`.
 *
 * If the user has an active Google session on this device AND
 * previously consented to auto sign-in for this client, FedCM (or a
 * legacy iframe on browsers without FedCM) returns a fresh ID token
 * without showing UI. Otherwise the prompt either renders One Tap UI
 * or returns nothing — either way we resolve to `null` so the caller
 * can fall back to the explicit sign-in button.
 *
 * Common reasons for a `null` resolution:
 *  - `unregistered_origin` — current origin is not in the OAuth
 *    client's "Authorized JavaScript origins" (Cloud Console fix);
 *  - `opt_out_or_no_session` — user signed out of Google or never
 *    enabled auto sign-in;
 *  - `suppressed_by_user` — user dismissed One Tap too many times;
 *  - `browser_not_supported` — neither FedCM nor the legacy iframe
 *    flow is available (rare, mostly very old browsers).
 */

const PROMPT_TIMEOUT_MS = 10_000;

interface IRequestSilentRefreshParams {
  readonly clientId: string;
  /** Email of the currently signed-in user — biases the GIS prompt to that account. */
  readonly loginHint?: string;
}

/**
 * Try to mint a fresh Google ID token without UI. Resolves with the
 * new credential string, or `null` when GIS could not deliver one.
 *
 * The promise is non-rejecting by design: the caller (token refresh
 * flow) treats both "no GIS available" and "GIS declined to issue"
 * the same way — either keep using the current token until it
 * expires or surface the sign-in gate.
 */
export function requestGoogleSilentRefresh(
  params: IRequestSilentRefreshParams
): Promise<string | null> {
  const { clientId, loginHint } = params;
  const accountsId = window.google?.accounts?.id;
  if (accountsId === undefined) {
    return Promise.resolve(null);
  }
  if (clientId.trim().length === 0) {
    return Promise.resolve(null);
  }

  return new Promise<string | null>(resolve => {
    let isSettled = false;
    const settle = (value: string | null): void => {
      if (isSettled) {
        return;
      }
      isSettled = true;
      // Cancel any in-flight prompt so a stuck FedCM dialog does not
      // pin the next refresh attempt.
      try {
        accountsId.cancel();
      } catch {
        // `cancel()` throws when there is no active prompt — safe to ignore.
      }
      resolve(value);
    };

    // Watchdog: GIS occasionally fails to call back at all (network
    // hiccup, blocked third-party storage). Without a timeout the
    // refresh promise would dangle forever and the server-driven
    // `auth:token-expiring` handler would block on it.
    const timeoutHandle = setTimeout(() => settle(null), PROMPT_TIMEOUT_MS);

    accountsId.initialize({
      client_id: clientId,
      auto_select: true,
      cancel_on_tap_outside: false,
      // FedCM is the modern silent path on Chromium / Edge. Firefox
      // falls back to the legacy iframe transport — same outcome
      // from our side: we either get a credential or a null.
      use_fedcm_for_prompt: true,
      login_hint: loginHint,
      callback: response => {
        clearTimeout(timeoutHandle);
        if (typeof response.credential === 'string' && response.credential.length > 0) {
          settle(response.credential);
        } else {
          settle(null);
        }
      },
    });

    accountsId.prompt(notification => {
      // We only need to resolve eagerly when we know GIS will not call
      // the credential callback. If the prompt is displayed (One Tap
      // UI or FedCM dialog), we wait for the user's choice — the
      // callback above will fire on success, or the watchdog
      // timeout will fire on dismiss / no choice.
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        clearTimeout(timeoutHandle);
        settle(null);
      }
    });
  });
}
