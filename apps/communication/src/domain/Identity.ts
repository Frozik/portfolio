import type { TIdentityProvider } from '@frozik/communication-protocol/identity';
import type { DisplayName, Milliseconds, UserId } from './types';

export type { AuthErrorCode } from '@frozik/communication-protocol/messages';

export type Identity = {
  userId: UserId;
  displayName: DisplayName;
  socketId: string;
};

/**
 * Provider-agnostic claims surfaced by every `IIdentityVerifier`. Each
 * verifier internally validates provider-specific fields (Google's
 * `iss`/`aud`/`azp`, Yandex' `iss = 'login.yandex.ru'`, etc.) and
 * presents the same canonical shape to downstream code.
 *
 * `sub` is namespaced as `${provider}:${rawSub}` so different providers
 * cannot accidentally produce colliding `userId`s.
 */
export type TokenClaims = {
  sub: UserId;
  exp: Milliseconds;
  iat: Milliseconds;
  provider: TIdentityProvider;
  name?: string;
  email?: string;
  /**
   * Google session-id claim. Used by `ConnectionLifecycle.onRefresh` to
   * detect cross-session token replays for Google. Yandex JWTs do not
   * carry an `sid` — left undefined on that path.
   */
  sid?: string;
};
