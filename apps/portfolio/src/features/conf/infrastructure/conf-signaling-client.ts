import { isNil } from 'lodash-es';

import type {
  IConfSignalingClient,
  IConfSignalingClientParams,
  TConfSignalingConnectionState,
} from '../domain/ports/signaling-client';
import type { TConfSignalMessage } from '../domain/signaling-protocol';
import { parseConfSignalMessage } from '../domain/signaling-protocol';

type TMessageListener = (message: TConfSignalMessage) => void;
type TStateListener = (state: TConfSignalingConnectionState) => void;

/** Multiplexes conf messages over the generic `signal:publish` event; receivers filter by topic. */
interface IConfSignalEnvelope {
  readonly kind: 'conf-signal';
  readonly topic: string;
  /** Sender's session nonce; absent on older peers, then treated as a different session. */
  readonly fromSession?: string;
  readonly message: TConfSignalMessage;
}

function isConfSignalEnvelope(value: unknown): value is IConfSignalEnvelope {
  if (isNil(value) || typeof value !== 'object') {
    return false;
  }
  const envelope = value as Record<string, unknown>;
  return (
    envelope.kind === 'conf-signal' &&
    typeof envelope.topic === 'string' &&
    (envelope.fromSession === undefined || typeof envelope.fromSession === 'string') &&
    !isNil(envelope.message) &&
    typeof envelope.message === 'object'
  );
}

/**
 * Conf signaling over the shared communication client. Messages published
 * before the socket finished its handshake are queued and flushed on the
 * first `open`, so the join flow can announce itself immediately. Cross-room
 * envelopes and true self-echoes (same id and session) are dropped.
 */
export function createConfSignalingClient(
  params: IConfSignalingClientParams
): IConfSignalingClient {
  const { client, topic, self, selfSession } = params;
  const messageListeners = new Set<TMessageListener>();
  const stateListeners = new Set<TStateListener>();
  const pendingPublishes: TConfSignalMessage[] = [];
  let state: TConfSignalingConnectionState = client.state === 'open' ? 'open' : 'connecting';
  let isDisposed = false;

  function setState(next: TConfSignalingConnectionState): void {
    if (state === next) {
      return;
    }
    state = next;
    for (const listener of stateListeners) {
      listener(next);
    }
  }

  /** The ack promise may reject when the socket drops mid-flight; the peer state machine retries on its own. */
  function sendNow(message: TConfSignalMessage): void {
    const envelope: IConfSignalEnvelope = {
      kind: 'conf-signal',
      topic,
      fromSession: selfSession,
      message,
    };
    client.signalPublish(envelope).catch(() => undefined);
  }

  function flushPending(): void {
    for (const message of pendingPublishes.splice(0)) {
      sendNow(message);
    }
  }

  const unsubscribeState = client.onConnectionStateChange(next => {
    setState(next);
    if (next === 'open') {
      flushPending();
    }
  });

  const unsubscribeSignal = client.onSignalEvent(event => {
    const envelope = event.payload;
    if (!isConfSignalEnvelope(envelope) || envelope.topic !== topic) {
      return;
    }
    const message = parseConfSignalMessage(envelope.message);
    if (isNil(message) || (message.from === self && envelope.fromSession === selfSession)) {
      return;
    }
    for (const listener of messageListeners) {
      listener(message);
    }
  });

  return {
    get state() {
      return state;
    },
    onMessage(listener) {
      messageListeners.add(listener);
      return () => {
        messageListeners.delete(listener);
      };
    },
    onStateChange(listener) {
      stateListeners.add(listener);
      return () => {
        stateListeners.delete(listener);
      };
    },
    publish(message) {
      if (isDisposed) {
        return;
      }
      if (client.state !== 'open') {
        pendingPublishes.push(message);
        return;
      }
      sendNow(message);
    },
    dispose() {
      if (isDisposed) {
        return;
      }
      isDisposed = true;
      pendingPublishes.length = 0;
      unsubscribeSignal();
      unsubscribeState();
      messageListeners.clear();
      stateListeners.clear();
      setState('closed');
    },
  };
}
