import type { TIdentityProvider } from './identity';

/**
 * Wire-format message types for the communication server, shared by server and
 * client so the compiler catches any drift in the contract. Validation (Zod)
 * lives server-side; these are the structural source of truth both sides type
 * against.
 */

/** Auth failure reasons returned on the handshake and token-refresh paths. */
export type AuthErrorCode =
  | 'auth/invalid-token'
  | 'auth/expired-token'
  | 'auth/wrong-audience'
  | 'auth/wrong-issuer'
  | 'auth/missing-fields'
  | 'auth/jwks-unreachable'
  | 'auth/missing-name-claim'
  | 'auth/sub-mismatch'
  | 'auth/rate-limited';

/** Participant identity envelope carried on signal/command events. */
export interface IParticipantSummary {
  readonly userId: string;
  readonly displayName: string;
  readonly socketId: string;
}

/** Reduced presence entry (no socketId — presence aggregates per user). */
export interface IPresenceUser {
  readonly userId: string;
  readonly displayName: string;
}

export interface IHandshakeAuth {
  readonly roomId: string;
  /**
   * Discriminator for which OIDC provider issued `token`. Optional — when
   * omitted (with `token`), the connection joins anonymously and no identity
   * verification runs.
   */
  readonly provider?: TIdentityProvider;
  /**
   * Provider-issued JWT presented by the client (Google id_token / Yandex
   * `/info?format=jwt`). Optional — omitted (with `provider`) for anonymous.
   */
  readonly token?: string;
}

export interface IInitiatePayload {
  readonly command: string;
  readonly payload: unknown;
  readonly correlationId: string;
}

export interface IInitiateAck {
  readonly socketCount: number;
  readonly users: ReadonlyArray<IPresenceUser>;
  readonly correlationId: string;
}

export interface IExecuteEvent {
  readonly command: string;
  readonly payload: unknown;
  readonly correlationId: string;
  readonly initiator: IParticipantSummary;
}

export interface IExecuteAck {
  readonly payload: unknown;
  readonly correlationId: string;
}

export type ResponseKind = 'success' | 'timeout' | 'responder-disconnected' | 'dispatch-rejected';

export interface IResponseEvent {
  readonly kind: ResponseKind;
  readonly correlationId: string;
  readonly responder?: IParticipantSummary;
  readonly payload?: unknown;
  readonly reason?: string;
}

export interface IRoomPresenceEvent {
  readonly socketCount: number;
  readonly users: ReadonlyArray<IPresenceUser>;
}

export interface ITokenExpiringEvent {
  readonly expiresAt: string;
  readonly secondsRemaining: number;
}

export interface IRefreshTokenPayload {
  /** New provider-issued JWT. Provider stays the same as the handshake. */
  readonly token: string;
}

export type IRefreshTokenAck =
  | { readonly ok: true; readonly expiresAt: string }
  | { readonly ok: false; readonly error: AuthErrorCode };

export interface ISignalPublishPayload {
  readonly payload: unknown;
  readonly correlationId?: string;
}

export interface ISignalEventOutbound {
  readonly payload: unknown;
  readonly from: IParticipantSummary;
  readonly correlationId?: string;
}

export type SignalAck =
  | { readonly ok: true; readonly recipientCount: number }
  | {
      readonly ok: false;
      readonly error:
        | 'rate-limited'
        | 'payload-too-large'
        | 'invalid-payload'
        | 'not-in-room'
        | 'internal';
    };

export interface ITurnCredentialsAck {
  readonly username: string;
  readonly credential: string;
  readonly ttl: number;
  readonly urls: ReadonlyArray<string>;
}

/** Empty by design — present so the wire format is explicitly typed. */
export type IServerDrainingEvent = Record<string, never>;

/** Empty payload — server hint to refresh TURN creds + restart ICE mid-call. */
export type ITurnCredentialsRenewedEvent = Record<string, never>;
