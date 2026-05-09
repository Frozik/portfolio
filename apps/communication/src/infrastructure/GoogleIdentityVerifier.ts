import { createRemoteJWKSet, errors as joseErrors, jwtVerify } from 'jose';
import pRetry from 'p-retry';
import { Temporal } from 'temporal-polyfill';
import type { IVerifierHealth } from '../application/ports/IVerifierHealth';
import type { Result } from '../application/Result';
import { err, ok } from '../application/Result';
import type { AuthErrorCode, TokenClaims } from '../domain/Identity';
import type { IIdentityVerifier } from '../domain/IIdentityVerifier';
import type { Milliseconds, UserId } from '../domain/types';

const SECONDS_TO_MS = 1000;
const RETRY_MIN_TIMEOUT_MS = 100;
const RETRY_BACKOFF_FACTOR = 5;
const ALLOWED_ALGORITHM = 'RS256';

export type GoogleIdentityVerifierConfig = {
  audience: string;
  issuers: ReadonlyArray<string>; // ['https://accounts.google.com', 'accounts.google.com']
  jwksUrl: URL; // typically new URL('https://www.googleapis.com/oauth2/v3/certs')
  clockToleranceSec: number;
  fetchMaxAttempts: number;
  fetchTimeoutMs: number;
};

export class GoogleIdentityVerifier implements IIdentityVerifier, IVerifierHealth {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private lastSuccessAtMs: number | null = null;
  private lastFailureAtMs: number | null = null;
  private consecutiveFailures = 0;

  constructor(private readonly cfg: GoogleIdentityVerifierConfig) {
    this.jwks = createRemoteJWKSet(cfg.jwksUrl, {
      timeoutDuration: cfg.fetchTimeoutMs,
    });
  }

  async verify(idToken: string): Promise<Result<TokenClaims, AuthErrorCode>> {
    try {
      const { payload } = await pRetry(
        () =>
          jwtVerify(idToken, this.jwks, {
            algorithms: [ALLOWED_ALGORITHM], // C4 — pin alg, reject HS256 / "none"
            issuer: [...this.cfg.issuers],
            audience: this.cfg.audience,
            clockTolerance: this.cfg.clockToleranceSec,
          }),
        {
          retries: Math.max(0, this.cfg.fetchMaxAttempts - 1),
          minTimeout: RETRY_MIN_TIMEOUT_MS,
          factor: RETRY_BACKOFF_FACTOR,
          shouldRetry: ({ error }) => isTransientJwksError(error),
        }
      );

      this.lastSuccessAtMs = Temporal.Now.instant().epochMilliseconds;
      this.consecutiveFailures = 0;

      // M9: defense in depth — if `azp` is present it must match the audience.
      if (typeof payload.azp === 'string' && payload.azp !== this.cfg.audience) {
        return err('auth/wrong-audience');
      }

      const sub = payload.sub;
      if (typeof sub !== 'string' || sub.length === 0) {
        return err('auth/missing-fields');
      }

      const expSec = payload.exp;
      const iatSec = payload.iat;
      if (typeof expSec !== 'number' || typeof iatSec !== 'number') {
        return err('auth/invalid-token');
      }

      const claims: TokenClaims = {
        sub: sub as UserId,
        exp: (expSec * SECONDS_TO_MS) as Milliseconds,
        iat: (iatSec * SECONDS_TO_MS) as Milliseconds,
        iss: typeof payload.iss === 'string' ? payload.iss : '',
        aud: typeof payload.aud === 'string' ? payload.aud : '',
        name: typeof payload.name === 'string' ? payload.name : undefined,
        email: typeof payload.email === 'string' ? payload.email : undefined,
        sid: typeof payload.sid === 'string' ? payload.sid : undefined,
        azp: typeof payload.azp === 'string' ? payload.azp : undefined,
      };
      return ok(claims);
    } catch (error: unknown) {
      this.lastFailureAtMs = Temporal.Now.instant().epochMilliseconds;
      this.consecutiveFailures += 1;
      return err(mapJoseErrorToAuthCode(error));
    }
  }

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
  if (error instanceof joseErrors.JWKSNoMatchingKey) {
    return 'auth/jwks-unreachable';
  }
  if (error instanceof joseErrors.JWKSTimeout) {
    return 'auth/jwks-unreachable';
  }
  if (error instanceof joseErrors.JWKSInvalid) {
    return 'auth/jwks-unreachable';
  }
  // Network / fetch errors → jwks-unreachable
  return 'auth/jwks-unreachable';
}

function isTransientJwksError(error: unknown): boolean {
  if (error instanceof joseErrors.JWKSTimeout) {
    return true;
  }
  if (error instanceof joseErrors.JWKSInvalid) {
    return true;
  }
  if (error instanceof joseErrors.JWKSNoMatchingKey) {
    return true;
  }
  if (error instanceof Error) {
    return /fetch|network|ECONN|ETIMEDOUT|ENOTFOUND|EAI_AGAIN/i.test(error.message);
  }
  return false;
}
