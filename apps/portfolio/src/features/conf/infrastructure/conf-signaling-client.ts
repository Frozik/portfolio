import type { Milliseconds } from '@frozik/utils/date/types';
import { parseJson } from '@frozik/utils/parseJson';
import { isNil } from 'lodash-es';
import {
  SIGNALING_HEARTBEAT_MS,
  SIGNALING_RECONNECT_MAX_MS,
  SIGNALING_RECONNECT_MIN_MS,
} from '../domain/constants';
import type { TConfSignalMessage } from '../domain/signaling-protocol';
import { parseConfSignalMessage } from '../domain/signaling-protocol';
import type { ParticipantId } from '../domain/types';

/** Connection lifecycle reported to subscribers. */
export type TConfSignalingConnectionState = 'idle' | 'connecting' | 'open' | 'closed';

/**
 * Subset of the signaling wire protocol conf cares about. We only
 * parse `publish` envelopes — `pong` is accepted as a no-op, everything
 * else is ignored.
 */
interface IPublishEnvelope {
  readonly type: 'publish';
  readonly topic: string;
  readonly data?: unknown;
}

export interface IConfSignalingClientParams {
  readonly serverUrls: readonly string[];
  readonly topic: string;
  /** Participant id of the local client; used to drop self-echoes server-side relays do not filter. */
  readonly self: ParticipantId;
}

type TMessageListener = (message: TConfSignalMessage) => void;
type TStateListener = (state: TConfSignalingConnectionState) => void;

export interface IConfSignalingClient {
  readonly state: TConfSignalingConnectionState;
  onMessage(listener: TMessageListener): () => void;
  onStateChange(listener: TStateListener): () => void;
  publish(message: TConfSignalMessage): void;
  dispose(): void;
}

const RECONNECT_BACKOFF_FACTOR = 2;
const MAX_RETRY_BITS = 6; // caps the exponent so the shift does not overflow

/**
 * WebSocket client that speaks the shared signaling server's generic
 * pub/sub protocol (subscribe / unsubscribe / publish / ping) and
 * layers conf's `TConfSignalMessage` schema on top of the `publish`
 * envelope's `data` field.
 *
 * Features:
 *  - Picks the first URL from `serverUrls` and reconnects with
 *    exponential backoff between `SIGNALING_RECONNECT_MIN_MS` and
 *    `SIGNALING_RECONNECT_MAX_MS`.
 *  - Sends `{ type: 'ping' }` every `SIGNALING_HEARTBEAT_MS` to keep
 *    the connection alive behind NATs.
 *  - Queues outgoing messages while the socket is not open.
 *  - Drops self-echoed publishes (`from === self`). The server does
 *    not loop messages back to the originator but some proxies do.
 */
export function createConfSignalingClient(
  params: IConfSignalingClientParams
): IConfSignalingClient {
  const { serverUrls, topic, self } = params;
  const messageListeners = new Set<TMessageListener>();
  const stateListeners = new Set<TStateListener>();
  const outbox: TConfSignalMessage[] = [];

  let socket: WebSocket | null = null;
  let state: TConfSignalingConnectionState = 'idle';
  let reconnectTimerId: ReturnType<typeof setTimeout> | null = null;
  let heartbeatIntervalId: ReturnType<typeof setInterval> | null = null;
  let retryCount = 0;
  let isDisposed = false;

  function setState(next: TConfSignalingConnectionState): void {
    if (state === next) {
      return;
    }
    state = next;
    stateListeners.forEach(listener => listener(next));
  }

  function clearHeartbeat(): void {
    if (heartbeatIntervalId !== null) {
      clearInterval(heartbeatIntervalId);
      heartbeatIntervalId = null;
    }
  }

  function clearReconnectTimer(): void {
    if (reconnectTimerId !== null) {
      clearTimeout(reconnectTimerId);
      reconnectTimerId = null;
    }
  }

  function startHeartbeat(): void {
    clearHeartbeat();
    heartbeatIntervalId = setInterval(() => {
      if (socket !== null && socket.readyState === WebSocket.OPEN) {
        sendRaw({ type: 'ping' });
      }
    }, SIGNALING_HEARTBEAT_MS);
  }

  function sendRaw(payload: unknown): void {
    if (socket === null || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    try {
      socket.send(JSON.stringify(payload));
    } catch {
      // Swallow — the socket will emit `close` and the reconnect
      // loop will pick up from there.
    }
  }

  function flushOutbox(): void {
    while (outbox.length > 0) {
      const next = outbox.shift();
      if (isNil(next)) {
        return;
      }
      sendRaw({ type: 'publish', topic, data: next });
    }
  }

  function scheduleReconnect(): void {
    if (isDisposed) {
      return;
    }
    clearReconnectTimer();
    const exponent = Math.min(retryCount, MAX_RETRY_BITS);
    const backoff = Math.min(
      SIGNALING_RECONNECT_MAX_MS,
      (SIGNALING_RECONNECT_MIN_MS * RECONNECT_BACKOFF_FACTOR ** exponent) as Milliseconds
    );
    retryCount += 1;
    reconnectTimerId = setTimeout(() => {
      reconnectTimerId = null;
      connect();
    }, backoff);
  }

  function handleRawMessage(raw: unknown): void {
    if (typeof raw !== 'string') {
      return;
    }
    const parsed = parseJson<unknown>(raw);
    if (isNil(parsed) || typeof parsed !== 'object' || parsed === null) {
      return;
    }
    const envelope = parsed as Record<string, unknown>;
    if (envelope.type !== 'publish') {
      return;
    }
    const publishEnvelope = envelope as unknown as IPublishEnvelope;
    if (publishEnvelope.topic !== topic) {
      return;
    }
    const message = parseConfSignalMessage(publishEnvelope.data);
    if (message === null) {
      return;
    }
    if (message.from === self) {
      return;
    }
    messageListeners.forEach(listener => listener(message));
  }

  function connect(): void {
    if (isDisposed) {
      return;
    }
    if (serverUrls.length === 0) {
      setState('closed');
      return;
    }

    const url = serverUrls[0];
    setState('connecting');

    let nextSocket: WebSocket;
    try {
      nextSocket = new WebSocket(url);
    } catch {
      scheduleReconnect();
      return;
    }
    socket = nextSocket;

    nextSocket.addEventListener('open', () => {
      if (socket !== nextSocket) {
        return;
      }
      retryCount = 0;
      setState('open');
      sendRaw({ type: 'subscribe', topics: [topic] });
      startHeartbeat();
      flushOutbox();
    });

    nextSocket.addEventListener('message', event => {
      if (socket !== nextSocket) {
        return;
      }
      handleRawMessage(event.data);
    });

    nextSocket.addEventListener('close', () => {
      if (socket !== nextSocket) {
        return;
      }
      socket = null;
      clearHeartbeat();
      if (isDisposed) {
        setState('closed');
        return;
      }
      setState('closed');
      scheduleReconnect();
    });

    nextSocket.addEventListener('error', () => {
      // The `close` event always follows; let it drive the reconnect.
    });
  }

  function publish(message: TConfSignalMessage): void {
    if (isDisposed) {
      return;
    }
    if (socket !== null && socket.readyState === WebSocket.OPEN) {
      sendRaw({ type: 'publish', topic, data: message });
      return;
    }
    outbox.push(message);
  }

  function onMessage(listener: TMessageListener): () => void {
    messageListeners.add(listener);
    return () => {
      messageListeners.delete(listener);
    };
  }

  function onStateChange(listener: TStateListener): () => void {
    stateListeners.add(listener);
    return () => {
      stateListeners.delete(listener);
    };
  }

  function dispose(): void {
    if (isDisposed) {
      return;
    }
    isDisposed = true;
    clearReconnectTimer();
    clearHeartbeat();
    if (socket !== null) {
      try {
        if (socket.readyState === WebSocket.OPEN) {
          sendRaw({ type: 'unsubscribe', topics: [topic] });
        }
        socket.close();
      } catch {
        // Closing a dead socket is a no-op.
      }
      socket = null;
    }
    messageListeners.clear();
    stateListeners.clear();
    outbox.length = 0;
    setState('closed');
  }

  connect();

  return {
    get state() {
      return state;
    },
    onMessage,
    onStateChange,
    publish,
    dispose,
  };
}
