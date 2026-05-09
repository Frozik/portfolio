import { randomUUID } from 'node:crypto';
import type { AuthErrorCode, Identity, TokenClaims } from '../domain/Identity';
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
  verifier: IIdentityVerifier;
  googleClientId: string;
  googleIssuers: ReadonlyArray<string>;
  audit: IAuditLogger;
  logger: IServerLogger;
  // v2: per-room allowlist. Empty = no enforcement.
  roomAllowlist: ReadonlyArray<RoomAllowlistEntry>;
};

export type HandshakeOutput = {
  identity: Identity;
  claims: TokenClaims;
  socketId: SocketId;
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

    const verifyResult = await this.deps.verifier.verify(parsed.idToken);
    if (!verifyResult.ok) {
      return err(verifyResult.error);
    }
    const claims = verifyResult.value;

    const audienceCheck = this.checkAudience(claims);
    if (!audienceCheck.ok) {
      return audienceCheck;
    }
    const issuerCheck = this.checkIssuer(claims);
    if (!issuerCheck.ok) {
      return issuerCheck;
    }

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
    return ok({ identity, claims, socketId });
  }

  public async onRefresh(
    currentClaims: TokenClaims,
    newIdToken: string
  ): Promise<Result<TokenClaims, AuthErrorCode>> {
    const verifyResult = await this.deps.verifier.verify(newIdToken);
    if (!verifyResult.ok) {
      return err(verifyResult.error);
    }
    const newClaims = verifyResult.value;

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

    const audienceCheck = this.checkAudience(newClaims);
    if (!audienceCheck.ok) {
      return audienceCheck;
    }
    const issuerCheck = this.checkIssuer(newClaims);
    if (!issuerCheck.ok) {
      return issuerCheck;
    }
    return ok(newClaims);
  }

  public onDisconnect(socketId: SocketId, roomId: RoomId, registry: IRoomRegistry): void {
    registry.release(roomId, socketId);
  }

  private checkAudience(claims: TokenClaims): Result<true, AuthErrorCode> {
    if (claims.aud !== this.deps.googleClientId) {
      return err('auth/wrong-audience');
    }
    if (claims.azp !== undefined && claims.azp !== this.deps.googleClientId) {
      return err('auth/wrong-audience');
    }
    return ok(true);
  }

  private checkIssuer(claims: TokenClaims): Result<true, AuthErrorCode> {
    if (!this.deps.googleIssuers.includes(claims.iss)) {
      return err('auth/wrong-issuer');
    }
    return ok(true);
  }
}
