import type { IOidcProfile, IOidcSignInResult, TIdentityProvider } from './types';

/**
 * Provider-agnostic facade for sign-in + silent refresh + profile
 * decoding. Each implementation hides the SDK or popup specifics of one
 * OIDC provider behind this contract so the rest of the app (and
 * `AuthSession` in particular) treats them uniformly.
 *
 * Concrete providers live alongside this file:
 *  - `GoogleOidcProvider` — Google Identity Services / FedCM
 *  - `YandexOidcProvider` — popup + `oauth.yandex.com` + `/info?format=jwt`
 */
export interface IOidcProvider {
  readonly id: TIdentityProvider;
  /** Display label rendered next to / on the sign-in button. */
  readonly displayName: string;

  /**
   * User-driven sign-in. Resolves with the issued token + profile, or
   * `null` when the user dismisses the popup / FedCM dialog. Never
   * rejects — every provider error surfaces as `null` so the
   * `<SignInGate>` can stay idle and let the user retry.
   */
  signIn(): Promise<IOidcSignInResult | null>;

  /**
   * Best-effort silent refresh ahead of token expiry. Resolves `null`
   * when the provider cannot deliver a fresh token without user
   * interaction (no active session, blocked third-party storage,
   * provider-side rate limit, ...).
   *
   * @param loginHint When present, biases the provider to the user
   *                  with this email / login. Plumbed from the
   *                  currently signed-in profile.
   */
  silentRefresh(loginHint?: string): Promise<IOidcSignInResult | null>;

  /**
   * Pure decode of an already-issued token (used on session rehydrate
   * from `sessionStorage`). Throws on a malformed token; callers should
   * treat that as a sign-out.
   */
  decodeProfile(token: string): IOidcProfile;

  /**
   * Optional hook called when the user explicitly signs out. Providers
   * with their own private cache (e.g. Yandex' OAuth `access_token`)
   * use this to clear it so a subsequent sign-in starts clean.
   */
  signOut?(): void;
}
