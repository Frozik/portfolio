/**
 * OIDC-specific client types. The provider discriminator (`TIdentityProvider`)
 * lives in `@frozik/communication-protocol/identity` — import it directly from
 * there at each use site.
 */

/**
 * Snapshot of the user's profile pulled out of a verified provider
 * token. Only fields the UI actually displays are surfaced here — the
 * raw JWT stays in the `AuthSession` for outbound handshakes.
 */
export interface IOidcProfile {
  /** Namespaced — always `${provider}:${rawSub}`. */
  readonly userId: string;
  readonly name: string;
  readonly email?: string;
  readonly pictureUrl?: string;
}

export interface IOidcSignInResult {
  readonly token: string;
  readonly profile: IOidcProfile;
  /**
   * Provider-specific token used to fetch a fresh signed JWT during
   * silent refresh. Yandex returns an opaque OAuth `access_token`
   * (long-lived, up to a year) which the client exchanges for a new
   * `/info?format=jwt` response. Google does not need this — silent
   * refresh goes through GIS' `prompt()` flow.
   */
  readonly accessToken?: string;
}
