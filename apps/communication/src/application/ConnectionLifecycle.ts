import { randomUUID } from 'node:crypto';
import type { AuthErrorCode, Identity, TokenClaims } from '../domain/Identity';
import type { TIdentityProvider } from '../domain/IdentityProvider';
import type { IIdentityVerifier } from '../domain/IIdentityVerifier';
import type { IRoomRegistry } from '../domain/IRoomRegistry';
import type { IHandshakeAuth } from '../domain/protocol';
import { parseHandshakeAuth } from '../domain/protocol-validators';
import type { DisplayName, RoomId, SocketId } from '../domain/types';
import { assertDisplayName } from '../domain/types';
import type { RoomAllowlistEntry } from './config/sections/room-section';
import type { IAuditLogger } from './ports/IAuditLogger';
import type { IServerLogger } from './ports/IServerLogger';
import type { Result } from './Result';
import { err, ok } from './Result';
import { checkRoomAllowlist } from './RoomAllowlistChecker';

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
  // v2: per-room allowlist. Empty = no enforcement.
  roomAllowlist: ReadonlyArray<RoomAllowlistEntry>;
};

export type HandshakeOutput = {
  identity: Identity;
  claims: TokenClaims;
  socketId: SocketId;
  provider: TIdentityProvider;
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

    // v2: per-room allowlist (§13.2). Pure check; no I/O.
    const allowlistResult = checkRoomAllowlist(parsed.roomId, claims.sub, this.deps.roomAllowlist);
    if (!allowlistResult.ok) {
      return err('auth/forbidden-room');
    }

    const socketId: SocketId = randomUUID();
    const identity: Identity = {
      userId: claims.sub,
      displayName,
      socketId,
    };
    return ok({ identity, claims, socketId, provider: parsed.provider });
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

  public onDisconnect(socketId: SocketId, roomId: RoomId, registry: IRoomRegistry): void {
    registry.release(roomId, socketId);
  }
}
