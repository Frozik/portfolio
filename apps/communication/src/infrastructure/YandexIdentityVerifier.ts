import { errors as joseErrors, jwtVerify } from 'jose';
import { Temporal } from 'temporal-polyfill';
import type { IVerifierHealth } from '../application/ports/IVerifierHealth';
import type { AuthErrorCode, TokenClaims } from '../domain/Identity';
import type { IIdentityVerifier } from '../domain/IIdentityVerifier';
import type { Result } from '../domain/Result';
import { err, ok } from '../domain/Result';
import type { Milliseconds, UserId } from '../domain/types';
import type { IVerifierFactory } from './IVerifierFactory';

const SECONDS_TO_MS = 1000;
const ALLOWED_ALGORITHM = 'HS256';
const DEFAULT_ISSUER = 'login.yandex.ru';

export type YandexIdentityVerifierConfig = {
  /** UTF-8 string of the Yandex application's `client_secret`. */
  clientSecret: string;
  /**
   * Issuer claim Yandex stamps on JWTs returned from
   * `https://login.yandex.ru/info?format=jwt`. Configurable so tests can
   * pin a fixture issuer; production always uses `login.yandex.ru`.
   */
  expectedIssuer?: string;
  clockToleranceSec: number;
};

interface IYandexJwtPayload {
  iat?: number;
  exp?: number;
  iss?: string;
  uid?: number | string;
  login?: string;
  name?: string;
  display_name?: string;
  email?: string;
  default_email?: string;
  psuid?: string;
}

/**
 * Verifies Yandex-issued identity JWTs.
 *
 * Yandex' identity flow is: client gets an opaque OAuth `access_token`
 * (browser-side, implicit flow), then exchanges it for a signed JWT via
 * `GET https://login.yandex.ru/info?format=jwt`. The JWT is signed with
 * `HS256` using the registered application's `client_secret` as the
 * symmetric key — meaning only servers that already know the secret
 * (this one) can verify the signature.
 *
 * See https://yandex.com/dev/id/doc/en/tokens/jwt for the wire format.
 */
export class YandexIdentityVerifier implements IIdentityVerifier, IVerifierHealth {
  private readonly secretKey: Uint8Array;
  private readonly expectedIssuer: string;
  private lastSuccessAtMs: number | null = null;
  private lastFailureAtMs: number | null = null;
  private consecutiveFailures = 0;

  constructor(private readonly cfg: YandexIdentityVerifierConfig) {
    this.secretKey = new TextEncoder().encode(cfg.clientSecret);
    this.expectedIssuer = cfg.expectedIssuer ?? DEFAULT_ISSUER;
  }

  async verify(token: string): Promise<Result<TokenClaims, AuthErrorCode>> {
    try {
      const { payload } = await jwtVerify<IYandexJwtPayload>(token, this.secretKey, {
        algorithms: [ALLOWED_ALGORITHM],
        issuer: this.expectedIssuer,
        clockTolerance: this.cfg.clockToleranceSec,
      });

      this.lastSuccessAtMs = Temporal.Now.instant().epochMilliseconds;
      this.consecutiveFailures = 0;

      const rawUid = payload.uid;
      if (rawUid === undefined || rawUid === null) {
        return err('auth/missing-fields');
      }
      const subString = typeof rawUid === 'number' ? String(rawUid) : rawUid;
      if (subString.length === 0) {
        return err('auth/missing-fields');
      }

      const expSec = payload.exp;
      const iatSec = payload.iat;
      if (typeof expSec !== 'number' || typeof iatSec !== 'number') {
        return err('auth/invalid-token');
      }

      // Display name fallback chain: `display_name` is the user's chosen
      // public name, `name` is the registered real name, `login` is the
      // Yandex username. Pick the first that's a non-empty string.
      const displayName =
        firstNonEmpty(payload.display_name) ??
        firstNonEmpty(payload.name) ??
        firstNonEmpty(payload.login);

      // Email fallback: `default_email` is the active mailbox; `email`
      // can appear too on older accounts. Either is acceptable.
      const email = firstNonEmpty(payload.default_email) ?? firstNonEmpty(payload.email);

      const claims: TokenClaims = {
        sub: `yandex:${subString}` as UserId,
        exp: (expSec * SECONDS_TO_MS) as Milliseconds,
        iat: (iatSec * SECONDS_TO_MS) as Milliseconds,
        provider: 'yandex',
        name: displayName,
        email,
      };
      return ok(claims);
    } catch (error: unknown) {
      this.lastFailureAtMs = Temporal.Now.instant().epochMilliseconds;
      this.consecutiveFailures += 1;
      return err(mapJoseErrorToAuthCode(error));
    }
  }

  /**
   * Yandex verifier needs no remote resources at runtime — the secret
   * is loaded once at construction. The health snapshot still mirrors
   * Google's shape so dashboards can show both verifiers side by side.
   */
  getJwksFetchHealth(): {
    lastSuccessAtMs: number | null;
    lastFailureAtMs: number | null;
    consecutiveFailures: number;
  } {
    return {
      lastSuccessAtMs: this.lastSuccessAtMs,
      lastFailureAtMs: this.lastFailureAtMs,
      consecutiveFailures: this.consecutiveFailures,
    };
  }
}

function firstNonEmpty(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : value;
}

function mapJoseErrorToAuthCode(error: unknown): AuthErrorCode {
  if (error instanceof joseErrors.JWTExpired) {
    return 'auth/expired-token';
  }
  if (error instanceof joseErrors.JWTClaimValidationFailed) {
    if (error.claim === 'iss') {
      return 'auth/wrong-issuer';
    }
    if (error.claim === 'aud') {
      return 'auth/wrong-audience';
    }
    return 'auth/invalid-token';
  }
  if (error instanceof joseErrors.JWSSignatureVerificationFailed) {
    return 'auth/invalid-token';
  }
  if (error instanceof joseErrors.JWSInvalid) {
    return 'auth/invalid-token';
  }
  if (error instanceof joseErrors.JOSEAlgNotAllowed) {
    return 'auth/invalid-token';
  }
  if (error instanceof joseErrors.JWTInvalid) {
    return 'auth/invalid-token';
  }
  return 'auth/invalid-token';
}

/**
 * Factory entry consumed by `verifier-registry.ts`. Both Yandex env
 * vars must be present (id is public, secret is sensitive); a partial
 * config keeps the verifier unregistered and the Yandex sign-in path
 * disabled.
 */
export const yandexVerifierFactory: IVerifierFactory = {
  id: 'yandex',
  isConfigured: auth =>
    auth.yandex_oauth_client_id.length > 0 && auth.yandex_oauth_client_secret.length > 0,
  build: auth =>
    new YandexIdentityVerifier({
      clientSecret: auth.yandex_oauth_client_secret,
      clockToleranceSec: auth.clock_tolerance_seconds,
    }),
};
