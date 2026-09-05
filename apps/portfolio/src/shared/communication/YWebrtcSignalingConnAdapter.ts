import type { ISignalEventOutbound } from '@frozik/communication-protocol/messages';
import { merge, of, Subscription } from 'rxjs';
import { filter, map, switchMap, take } from 'rxjs/operators';
import type { ICommunicationClient } from './CommunicationClient';

/**
 * URL scheme used to mark a signaling URL as backed by a
 * `CommunicationClient` rather than a real `WebSocket`. The retro
 * provider passes `comm+ws://<token>` to `WebrtcProvider`; the
 * `MockWebSocket` shim installed below detects the prefix and
 * routes the connection through the registered communication
 * client instead of opening a network socket.
 */
const COMMUNICATION_SIGNALING_SCHEME = 'comm+ws://';

const MOCK_OPEN = 1;
const MOCK_CLOSED = 3;

interface IPublishEnvelope {
  readonly type: 'publish';
  readonly topic: string;
  readonly data: unknown;
}

interface ISubscribeEnvelope {
  readonly type: 'subscribe' | 'unsubscribe';
  readonly topics: ReadonlyArray<string>;
}

type TOutboundEnvelope = IPublishEnvelope | ISubscribeEnvelope | { readonly type: 'ping' | 'pong' };

/**
 * Per-roomId entry registered before a `WebrtcProvider` is built.
 * The entry binds a y-webrtc-style topic (`<roomPrefix><roomId>`)
 * to a `CommunicationClient` so the `MockWebSocket` shim can
 * forward `publish` envelopes through `signalPublish`.
 */
interface IRegistration {
  readonly client: ICommunicationClient;
  readonly topic: string;
  /** Listeners attached via the `MockWebSocket` instance. */
  sockets: Set<MockWebSocket>;
  unsubscribeSignal: (() => void) | null;
}

const registry = new Map<string, IRegistration>();

/**
 * Build the marker URL passed to `WebrtcProvider`'s `signaling`
 * array. The token must be unique per room — the URL is the key
 * the `MockWebSocket` shim uses to look up the registered
 * communication client.
 */
export function buildCommunicationSignalingUrl(token: string): string {
  return `${COMMUNICATION_SIGNALING_SCHEME}${encodeURIComponent(token)}`;
}

/**
 * Register a communication client + topic for the given URL token.
 * The token is whatever was encoded into
 * `buildCommunicationSignalingUrl`.
 *
 * Returns a teardown function that detaches the registration; it
 * MUST be called when the consumer disposes its provider so the
 * registry doesn't keep stale entries.
 */
export function registerCommunicationSignaling(params: {
  readonly token: string;
  readonly topic: string;
  readonly client: ICommunicationClient;
}): () => void {
  const { token, topic, client } = params;
  const url = buildCommunicationSignalingUrl(token);
  const entry: IRegistration = {
    client,
    topic,
    sockets: new Set<MockWebSocket>(),
    unsubscribeSignal: null,
  };
  entry.unsubscribeSignal = client.onSignalEvent((event: ISignalEventOutbound) => {
    // y-webrtc routes inbound signaling envelopes through
    // `WebsocketClient`'s `onmessage` handler. The lib parses the
    // string as JSON and dispatches based on `m.type === 'publish'`
    // — so we materialize the same envelope shape here.
    const envelope: IPublishEnvelope = {
      type: 'publish',
      topic,
      data: event.payload,
    };
    const serialized = JSON.stringify(envelope);
    for (const socket of entry.sockets) {
      socket.deliverMessage(serialized);
    }
  });
  registry.set(url, entry);
  return () => {
    const stored = registry.get(url);
    if (stored !== entry) {
      return;
    }
    entry.unsubscribeSignal?.();
    entry.unsubscribeSignal = null;
    for (const socket of entry.sockets) {
      socket.forceClose();
    }
    entry.sockets.clear();
    registry.delete(url);
  };
}

type TBinaryType = 'arraybuffer' | 'blob';

type TWebSocketEventHandler = ((event: Event) => void) | null;
type TWebSocketMessageHandler = ((event: MessageEvent<string>) => void) | null;

/**
 * Minimal `WebSocket`-shaped object that satisfies y-webrtc's
 * usage:
 *  - it accesses `binaryType`, `readyState`,
 *  - it sets `onopen` / `onmessage` / `onclose` / `onerror`,
 *  - it calls `send(JSON.stringify(envelope))` and `close()`.
 *
 * The `WebsocketClient` parent in lib0 also reads `event.data` as
 * a string in `onmessage` — we deliver strings to match.
 */
class MockWebSocket {
  public binaryType: TBinaryType = 'blob';
  public readyState: number = MOCK_OPEN;
  public onopen: TWebSocketEventHandler = null;
  public onclose: TWebSocketEventHandler = null;
  public onerror: TWebSocketEventHandler = null;
  public onmessage: TWebSocketMessageHandler = null;

  /**
   * `null` only when the socket was constructed AFTER its parent
   * registration had already been torn down — typically y-webrtc's
   * reconnect `setTimeout` firing late, after `RoomStore.dispose`
   * cleared the registry. Such a socket is permanently closed; every
   * accessor short-circuits on `isClosed=true`.
   */
  private readonly registration: IRegistration | null;
  private isClosed = false;
  private readonly lifecycleSubscription: Subscription;

  public constructor(public readonly url: string) {
    const entry = registry.get(url);
    if (entry === undefined) {
      // Late reconnect from y-webrtc / lib0 — the parent
      // `WebrtcProvider` has already been destroyed (or is about to
      // be), but its `WebsocketClient` had a reconnect timer queued
      // before `shouldConnect` flipped to false. Surface a stub
      // closed socket and fire `onclose` on the next microtask so
      // the parent client sees a clean disconnect and quietly winds
      // down its retry loop. Throwing here would propagate past
      // lib0's `setupWS` setTimeout as an uncaught exception.
      this.registration = null;
      this.isClosed = true;
      this.readyState = MOCK_CLOSED;
      this.lifecycleSubscription = new Subscription();
      queueMicrotask(() => {
        this.onclose?.(new Event('close'));
      });
      return;
    }
    this.registration = entry;
    entry.sockets.add(this);

    // Map the underlying CommunicationClient's connection state to the
    // pair of synthetic events y-webrtc cares about. Firing onopen
    // before Socket.IO is actually `'open'` makes y-webrtc immediately
    // call `send()` (publishing every subscribed topic) against a
    // not-yet-connected socket; this RxJS chain holds the synthetic
    // open until the first real `'open'`, then arms a one-shot close
    // for the next `'closed'` so a dropped socket surfaces to y-webrtc.
    this.lifecycleSubscription = entry.client.state$
      .pipe(
        filter(state => state === 'open'),
        take(1),
        switchMap(() =>
          merge(
            of('open' as const),
            entry.client.state$.pipe(
              filter(state => state === 'closed'),
              take(1),
              map(() => 'close' as const)
            )
          )
        )
      )
      .subscribe(event => {
        if (this.isClosed) {
          return;
        }
        if (event === 'open') {
          // Microtask defer so `WebsocketClient` finishes assigning
          // `wsclient.ws = websocket` before `onopen` fires.
          queueMicrotask(() => {
            if (!this.isClosed) {
              this.onopen?.(new Event('open'));
            }
          });
        } else {
          this.close();
        }
      });
  }

  public send(rawMessage: string): void {
    if (this.isClosed || this.registration === null) {
      return;
    }
    let envelope: TOutboundEnvelope;
    try {
      envelope = JSON.parse(rawMessage) as TOutboundEnvelope;
    } catch {
      return;
    }
    const registration = this.registration;
    if (envelope.type === 'publish') {
      // y-webrtc only ever publishes to its own room name; we
      // intentionally ignore any cross-room publish (it'd be a bug).
      if (envelope.topic !== registration.topic) {
        return;
      }
      // Defensive: even though MockWebSocket withholds `onopen` until the
      // CommunicationClient is `'open'`, swallow late-publish failures
      // so we never raise an unhandled rejection. y-webrtc retries on
      // its own poll cycle.
      registration.client.signalPublish(envelope.data).catch(() => undefined);
      return;
    }
    if (envelope.type === 'subscribe' || envelope.type === 'unsubscribe') {
      // The communication server scopes membership by `auth.roomId`
      // already — explicit subscribe / unsubscribe per topic is a
      // no-op.
      return;
    }
    if (envelope.type === 'ping') {
      // Mirror the `pong` shape lib0/websocket expects so its
      // ping-timeout watchdog does not nuke the connection.
      this.deliverMessage(JSON.stringify({ type: 'pong' }));
      return;
    }
  }

  public close(): void {
    if (this.isClosed) {
      return;
    }
    this.isClosed = true;
    this.readyState = MOCK_CLOSED;
    this.lifecycleSubscription.unsubscribe();
    this.registration?.sockets.delete(this);
    this.onclose?.(new Event('close'));
  }

  public addEventListener(): void {
    // y-webrtc never uses addEventListener — assignment-style only.
  }

  public removeEventListener(): void {
    // Same as above.
  }

  /** Deliver a synthetic message envelope from the upstream client. */
  public deliverMessage(serialized: string): void {
    if (this.isClosed) {
      return;
    }
    const handler = this.onmessage;
    if (handler === null) {
      return;
    }
    handler(new MessageEvent('message', { data: serialized }));
  }

  /** Force the socket closed without firing `onclose`. */
  public forceClose(): void {
    if (this.isClosed) {
      return;
    }
    this.isClosed = true;
    this.readyState = MOCK_CLOSED;
    // Drop the lifecycle stream too — a late `'closed'` from the
    // shared client must not call back into `close()` and surface a
    // synthetic onclose to a y-webrtc client that already hung up.
    this.lifecycleSubscription.unsubscribe();
  }
}

let isShimInstalled = false;

interface IWebSocketGlobal {
  WebSocket: {
    new (url: string, protocols?: string | string[]): WebSocket;
    readonly CLOSED: number;
    readonly CLOSING: number;
    readonly CONNECTING: number;
    readonly OPEN: number;
  };
}

/**
 * Install a process-wide `WebSocket` interceptor that detects URLs
 * starting with `comm+ws://` and returns a `MockWebSocket` backed
 * by the corresponding registered `CommunicationClient`. All other
 * URLs delegate to the real native constructor.
 *
 * The shim is idempotent — calling `installCommunicationWebSocketShim`
 * twice from different feature modules is safe.
 */
export function installCommunicationWebSocketShim(): void {
  if (isShimInstalled) {
    return;
  }
  isShimInstalled = true;
  const target = globalThis as unknown as IWebSocketGlobal;
  const NativeWebSocket = target.WebSocket;

  const Replacement = function ReplacementWebSocket(
    url: string,
    protocols?: string | string[]
  ): WebSocket {
    if (typeof url === 'string' && url.startsWith(COMMUNICATION_SIGNALING_SCHEME)) {
      // The cast is sound at runtime — y-webrtc only reads the
      // `WebSocket`-shaped subset we implement above.
      return new MockWebSocket(url) as unknown as WebSocket;
    }
    return new NativeWebSocket(url, protocols);
  } as unknown as IWebSocketGlobal['WebSocket'];

  // Preserve the static readyState constants so any consumer that
  // reads `WebSocket.OPEN` etc. keeps working.
  Object.defineProperties(Replacement, {
    CLOSED: { value: NativeWebSocket.CLOSED },
    CLOSING: { value: NativeWebSocket.CLOSING },
    CONNECTING: { value: NativeWebSocket.CONNECTING },
    OPEN: { value: NativeWebSocket.OPEN },
  });

  target.WebSocket = Replacement;
}
