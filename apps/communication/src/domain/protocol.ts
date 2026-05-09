import type { AuthErrorCode } from './Identity';
import type { SignalAck } from './Signal';

// Event-name string-literal constants. Both client and server MUST use these
// to avoid typos drift.

export const COMMAND_INITIATE = 'command:initiate';
export const COMMAND_EXECUTE = 'command:execute';
export const COMMAND_RESPONSE = 'command:response';
export const ROOM_PRESENCE = 'room:presence';
export const AUTH_TOKEN_EXPIRING = 'auth:token-expiring';
export const AUTH_TOKEN_EXPIRED = 'auth:token-expired';
export const AUTH_REFRESH_TOKEN = 'auth:refresh-token';
export const SIGNAL_PUBLISH = 'signal:publish';
export const SIGNAL_EVENT = 'signal:event';
export const TURN_REQUEST_CREDENTIALS = 'turn:request-credentials';
export const TURN_CREDENTIALS_RENEWED = 'turn:credentials-renewed';
export const SERVER_DRAINING = 'server:draining';

export interface IHandshakeAuth {
  roomId: string;
  idToken: string;
}

export interface IInitiatePayload {
  command: string;
  payload: unknown;
  correlationId: string;
}

export interface IInitiateAck {
  socketCount: number;
  users: ReadonlyArray<{ userId: string; displayName: string }>;
  correlationId: string;
}

export interface IExecuteEvent {
  command: string;
  payload: unknown;
  correlationId: string;
  initiator: { userId: string; displayName: string; socketId: string };
}

export interface IExecuteAck {
  payload: unknown;
  correlationId: string;
}

export type ResponseKind = 'success' | 'timeout' | 'responder-disconnected' | 'dispatch-rejected';

export interface IResponseEvent {
  kind: ResponseKind;
  correlationId: string;
  responder?: { userId: string; displayName: string; socketId: string };
  payload?: unknown;
  reason?: string;
}

export interface IRoomPresenceEvent {
  socketCount: number;
  users: ReadonlyArray<{ userId: string; displayName: string }>;
}

export interface ITokenExpiringEvent {
  expiresAt: string;
  secondsRemaining: number;
}

export interface IRefreshTokenPayload {
  idToken: string;
}

export type IRefreshTokenAck =
  | { ok: true; expiresAt: string }
  | { ok: false; error: AuthErrorCode };

export interface ISignalPublishPayload {
  payload: unknown;
  correlationId?: string;
}

export interface ISignalEventOutbound {
  payload: unknown;
  from: { userId: string; displayName: string; socketId: string };
  correlationId?: string;
}

export type ISignalAck = SignalAck;

export interface ITurnCredentialsAck {
  username: string;
  credential: string;
  ttl: number;
  urls: ReadonlyArray<string>;
}

// Empty by design — present so the wire format is explicitly typed.
export type IServerDrainingEvent = Record<string, never>;

// Empty payload — server hint that the client should refresh its TURN
// credentials and (if a peer connection is live) issue an ICE restart so the
// new credentials take effect mid-call. Emitted after every successful
// `auth:refresh-token`.
export type ITurnCredentialsRenewedEvent = Record<string, never>;
