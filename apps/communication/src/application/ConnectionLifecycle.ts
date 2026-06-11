import { randomUUID } from 'node:crypto';
import type { AuthErrorCode, Identity, TokenClaims } from '../domain/Identity';
import type { TIdentityProvider } from '../domain/IdentityProvider';
import type { IIdentityVerifier } from '../domain/IIdentityVerifier';
import type { IHandshakeAuth } from '../domain/protocol';
import { parseHandshakeAuth } from '../domain/protocol-validators';
import type { DisplayName, SocketId, UserId } from '../domain/types';
import { assertDisplayName } from '../domain/types';
import type { IAuditLogger } from './ports/IAuditLogger';
import type { IServerLogger } from './ports/IServerLogger';
import type { Result } from './Result';
import { err, ok } from './Result';

const ANONYMOUS_DISPLAY_NAME = assertDisplayName('Guest');

type ConnectionLifecycleDeps = {
  /**
   * Map of OIDC provider → verifier. Each verifier internally validates
   * provider-specific signing keys, issuer, and audience claims; this
   * class only routes by provider and consumes the canonical
   * `TokenClaims` they return.
   */
  verifiers: ReadonlyMap<TIdentityProvider, IIdentityVerifier>;
  audit: IAuditLogger;
  logger: IServerLogger;
};

export type HandshakeOutput = {
  /**
   * Identity with a PLACEHOLDER socketId — the presentation layer replaces
   * it with the real socket.id once the connection is admitted.
   */
  identity: Identity;
  /**
   * Verified OIDC claims, or `null` for anonymous handshakes that
   * arrived without a `provider`/`token` pair. Downstream code that
   * needs an expiry timer or refresh capability must gate on this.
   */
  claims: TokenClaims | null;
};

export class ConnectionLifecycle {
  public constructor(private readonly deps: ConnectionLifecycleDeps) {}

  public async onHandshake(
    handshakeAuth: IHandshakeAuth
  ): Promise<Result<HandshakeOutput, AuthErrorCode>> {
    let parsed: IHandshakeAuth;
    try {
      parsed = parseHandshakeAuth(handshakeAuth);
    } catch (_caught) {
      return err('auth/missing-fields');
    }

    const socketId: SocketId = randomUUID();

    if (parsed.provider === undefined || parsed.token === undefined) {
      // Anonymous handshake — no OIDC token presented. The room joins
      // without identity verification; downstream features that need
      // displayName use a generic placeholder.
      const identity: Identity = {
        userId: `anon:${randomUUID()}` as UserId,
        displayName: ANONYMOUS_DISPLAY_NAME,
        socketId,
      };
      return ok({ identity, claims: null });
    }

    const verifier = this.deps.verifiers.get(parsed.provider);
    if (verifier === undefined) {
      // Provider was disabled at deploy time (no client_id / secret). The
      // wire schema accepted it but we can't actually verify the token —
      // surface as invalid rather than a server error.
      return err('auth/invalid-token');
    }

    const verifyResult = await verifier.verify(parsed.token);
    if (!verifyResult.ok) {
      return err(verifyResult.error);
    }
    const claims = verifyResult.value;

    if (claims.name === undefined || claims.name.trim() === '') {
      return err('auth/missing-name-claim');
    }

    let displayName: DisplayName;
    try {
      displayName = assertDisplayName(claims.name);
    } catch (_caught) {
      return err('auth/missing-name-claim');
    }

    const identity: Identity = {
      userId: claims.sub,
      displayName,
      socketId,
    };
    return ok({ identity, claims });
  }

  public async onRefresh(
    currentClaims: TokenClaims,
    newToken: string
  ): Promise<Result<TokenClaims, AuthErrorCode>> {
    const verifier = this.deps.verifiers.get(currentClaims.provider);
    if (verifier === undefined) {
      // Same caveat as `onHandshake`: provider was disabled mid-flight
      // (re-deploy stripped its config). Force re-auth.
      return err('auth/invalid-token');
    }

    const verifyResult = await verifier.verify(newToken);
    if (!verifyResult.ok) {
      return err(verifyResult.error);
    }
    const newClaims = verifyResult.value;

    if (newClaims.provider !== currentClaims.provider) {
      // Defensive: client tried to swap providers under the same socket.
      return err('auth/sub-mismatch');
    }
    if (newClaims.sub !== currentClaims.sub) {
      return err('auth/sub-mismatch');
    }
    if (newClaims.iat <= currentClaims.iat) {
      // Replay / regression — refuse.
      return err('auth/invalid-token');
    }
    if (currentClaims.sid !== undefined && currentClaims.sid !== newClaims.sid) {
      return err('auth/invalid-token');
    }
    return ok(newClaims);
  }
}
