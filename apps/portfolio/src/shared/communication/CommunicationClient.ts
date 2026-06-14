import {
  AUTH_REFRESH_TOKEN,
  AUTH_TOKEN_EXPIRED,
  AUTH_TOKEN_EXPIRING,
  ROOM_PRESENCE,
  SERVER_DRAINING,
  SIGNAL_EVENT,
  SIGNAL_PUBLISH,
  TURN_CREDENTIALS_RENEWED,
  TURN_REQUEST_CREDENTIALS,
} from '@frozik/communication-protocol/events';
import type { TIdentityProvider } from '@frozik/communication-protocol/identity';
import type {
  IRoomPresenceEvent,
  ISignalEventOutbound,
  ITokenExpiringEvent,
  ITurnCredentialsAck,
  SignalAck,
} from '@frozik/communication-protocol/messages';
import type { Observable } from 'rxjs';
import { BehaviorSubject } from 'rxjs';
import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';

const ACK_TIMEOUT_MS = 10_000;

export type TConnectionState = 'idle' | 'connecting' | 'open' | 'closed';

export interface IAuthCredentials {
  readonly provider: TIdentityProvider;
  readonly token: string;
}

export interface ICommunicationClientParams {
  readonly baseUrl: string;
  readonly roomId: string;
  /**
   * Returns the current `{ provider, token }` pair, or `null` if the
   * user is signed out. The provider stays stable for the lifetime of
   * a socket — the server caches it on the first handshake.
   *
   * Omit entirely to connect anonymously — the handshake then sends
   * only `{ roomId }` and the server assigns a `Guest` identity.
   */
  readonly getCredentials?: () => IAuthCredentials | null;
  /**
   * Called when the server emits `auth:token-expiring`. The host
   * should resolve to a fresh provider-issued JWT (Google: silent
   * refresh via GIS; Yandex: re-call `/info?format=jwt`). Resolving
   * `null` indicates that no refresh is possible — the client will
   * surface the expiry via the `auth:token-expired` event when it
   * eventually fires.
   *
   * Required only when `getCredentials` is provided; anonymous
   * handshakes never receive `auth:token-expiring`.
   */
  readonly onTokenRefreshNeeded?: () => Promise<string | null>;
}

export type TTurnAck =
  | (ITurnCredentialsAck & { readonly ok?: true })
  | { readonly ok: false; readonly error: string };

type TUnsubscribe = () => void;

export interface ICommunicationClient {
  readonly state: TConnectionState;
  connect(): void;
  disconnect(): void;
  signalPublish(payload: unknown, correlationId?: string): Promise<SignalAck>;
  requestTurnCredentials(): Promise<ITurnCredentialsAck>;
  onSignalEvent(listener: (event: ISignalEventOutbound) => void): TUnsubscribe;
  onRoomPresence(listener: (event: IRoomPresenceEvent) => void): TUnsubscribe;
  onTokenExpiring(listener: (event: ITokenExpiringEvent) => void): TUnsubscribe;
  onTokenExpired(listener: () => void): TUnsubscribe;
  onServerDraining(listener: () => void): TUnsubscribe;
  /**
   * Server emits `turn:credentials-renewed` after every successful
   * `auth:refresh-token`. Subscribers should fetch fresh TURN credentials
   * via `requestTurnCredentials()` and (when a peer connection is live)
   * issue an ICE restart so the new creds take effect mid-call.
   */
  onTurnCredentialsRenewed(listener: () => void): TUnsubscribe;
  onConnectionStateChange(listener: (state: TConnectionState) => void): TUnsubscribe;
  /**
   * Reactive view of {@link state}. Replays the current value to every new
   * subscriber (BehaviorSubject) so consumers can compose `state$` with
   * RxJS operators without racing the initial emission.
   */
  readonly state$: Observable<TConnectionState>;
}

class TinyEmitter<T> {
  private readonly listeners = new Set<(value: T) => void>();

  public on(listener: (value: T) => void): TUnsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public emit(value: T): void {
    for (const listener of this.listeners) {
      listener(value);
    }
  }

  public clear(): void {
    this.listeners.clear();
  }
}

/**
 * Per-room Socket.IO client wrapper.
 *
 * One instance owns one Socket.IO connection — the wire protocol
 * scopes membership by `auth.roomId`, so feature code creates a
 * fresh `CommunicationClient` per room.
 *
 * Beyond the raw socket the wrapper also:
 *  - schedules a proactive token refresh whenever the server emits
 *    `auth:token-expiring`, so the same socket survives a token
 *    rollover instead of being torn down at expiry,
 *  - provides typed `signalPublish` / `requestTurnCredentials`
 *    helpers that wrap Socket.IO ack-style RPC into Promises,
 *  - exposes a tiny event API for signaling, presence, and
 *    lifecycle hooks consumed by the retro / conf features.
 */
export function createCommunicationClient(
  params: ICommunicationClientParams
): ICommunicationClient {
  const { baseUrl, roomId, getCredentials, onTokenRefreshNeeded } = params;

  const signalEmitter = new TinyEmitter<ISignalEventOutbound>();
  const presenceEmitter = new TinyEmitter<IRoomPresenceEvent>();
  const tokenExpiringEmitter = new TinyEmitter<ITokenExpiringEvent>();
  const tokenExpiredEmitter = new TinyEmitter<void>();
  const drainingEmitter = new TinyEmitter<void>();
  const turnRenewedEmitter = new TinyEmitter<void>();
  const stateEmitter = new TinyEmitter<TConnectionState>();
  const stateSubject = new BehaviorSubject<TConnectionState>('idle');

  let socket: Socket | null = null;
  let state: TConnectionState = 'idle';

  function setState(next: TConnectionState): void {
    if (state === next) {
      return;
    }
    state = next;
    stateEmitter.emit(next);
    stateSubject.next(next);
  }

  function attachListeners(active: Socket): void {
    active.on('connect', () => setState('open'));
    active.on('disconnect', () => setState('closed'));
    active.on('connect_error', () => setState('closed'));

    active.on(SIGNAL_EVENT, (event: ISignalEventOutbound) => {
      signalEmitter.emit(event);
    });
    active.on(ROOM_PRESENCE, (event: IRoomPresenceEvent) => {
      presenceEmitter.emit(event);
    });
    active.on(AUTH_TOKEN_EXPIRING, (event: ITokenExpiringEvent) => {
      tokenExpiringEmitter.emit(event);
      void refreshToken();
    });
    active.on(AUTH_TOKEN_EXPIRED, () => {
      tokenExpiredEmitter.emit();
    });
    active.on(SERVER_DRAINING, () => {
      drainingEmitter.emit();
    });
    active.on(TURN_CREDENTIALS_RENEWED, () => {
      turnRenewedEmitter.emit();
    });
  }

  async function refreshToken(): Promise<void> {
    if (socket === null || !socket.connected || onTokenRefreshNeeded === undefined) {
      return;
    }
    let nextToken: string | null;
    try {
      nextToken = await onTokenRefreshNeeded();
    } catch {
      nextToken = null;
    }
    if (nextToken === null) {
      return;
    }
    // Best-effort send. The server replies with an ack; we don't
    // need to retry on failure here — the next `auth:token-expiring`
    // (or eventual `auth:token-expired`) drives the next attempt.
    socket.timeout(ACK_TIMEOUT_MS).emit(
      AUTH_REFRESH_TOKEN,
      { token: nextToken },
      // Ack callback intentionally a no-op: failure is observable
      // via the next `auth:token-*` server event.
      () => undefined
    );
  }

  // Builds the handshake auth payload from the LATEST credentials. Returns
  // null only when an authenticated client has no active sign-in yet.
  function buildAuthPayload(): { roomId: string; provider?: string; token?: string } | null {
    if (getCredentials === undefined) {
      // Anonymous handshake — no provider/token. The server assigns a
      // `Guest` identity scoped to this socket.
      return { roomId };
    }
    const credentials = getCredentials();
    if (credentials === null) {
      return null;
    }
    return { roomId, provider: credentials.provider, token: credentials.token };
  }

  function connect(): void {
    if (socket !== null) {
      return;
    }
    if (buildAuthPayload() === null) {
      // No active sign-in → caller should surface a sign-in prompt; we keep
      // the client in `idle` so a later `connect()` after sign-in can
      // succeed without recreating the wrapper.
      return;
    }
    setState('connecting');
    const next = io(baseUrl, {
      // `auth` as a callback is re-invoked on every (re)connect, so an
      // automatic reconnect after a network blip presents a FRESH token
      // rather than the possibly-expired one captured at first connect.
      auth: cb => {
        const payload = buildAuthPayload();
        // A null payload (signed out mid-session) sends an empty handshake;
        // the server rejects it and onTokenExpired/disconnect handles cleanup.
        cb(payload ?? { roomId });
      },
      transports: ['websocket'],
      reconnection: true,
      // Keep noise low while debugging — feature stores log
      // upstream, the socket itself stays quiet.
      autoConnect: true,
    });
    socket = next;
    attachListeners(next);
  }

  function disconnect(): void {
    if (socket === null) {
      return;
    }
    socket.disconnect();
    socket.removeAllListeners();
    socket = null;
    setState('closed');
  }

  function signalPublish(payload: unknown, correlationId?: string): Promise<SignalAck> {
    return new Promise((resolve, reject) => {
      if (socket === null || !socket.connected) {
        reject(new Error('communication-client/not-connected'));
        return;
      }
      socket
        .timeout(ACK_TIMEOUT_MS)
        .emit(
          SIGNAL_PUBLISH,
          { payload, correlationId },
          (ackError: Error | null, ack: SignalAck) => {
            if (ackError !== null) {
              reject(ackError);
              return;
            }
            resolve(ack);
          }
        );
    });
  }

  function requestTurnCredentials(): Promise<ITurnCredentialsAck> {
    return new Promise((resolve, reject) => {
      if (socket === null || !socket.connected) {
        reject(new Error('communication-client/not-connected'));
        return;
      }
      socket
        .timeout(ACK_TIMEOUT_MS)
        .emit(TURN_REQUEST_CREDENTIALS, {}, (ackError: Error | null, ack: TTurnAck) => {
          if (ackError !== null) {
            reject(ackError);
            return;
          }
          if ('ok' in ack && ack.ok === false) {
            reject(new Error(`communication-client/turn-${ack.error}`));
            return;
          }
          resolve(ack as ITurnCredentialsAck);
        });
    });
  }

  return {
    get state() {
      return state;
    },
    connect,
    disconnect,
    signalPublish,
    requestTurnCredentials,
    onSignalEvent: listener => signalEmitter.on(listener),
    onRoomPresence: listener => presenceEmitter.on(listener),
    onTokenExpiring: listener => tokenExpiringEmitter.on(listener),
    onTokenExpired: listener => tokenExpiredEmitter.on(listener),
    onServerDraining: listener => drainingEmitter.on(listener),
    onTurnCredentialsRenewed: listener => turnRenewedEmitter.on(listener),
    onConnectionStateChange: listener => stateEmitter.on(listener),
    state$: stateSubject.asObservable(),
  };
}
