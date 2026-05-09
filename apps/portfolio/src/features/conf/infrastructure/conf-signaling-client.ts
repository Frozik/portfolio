import type { ICommunicationClient } from '../../../shared/communication/CommunicationClient';
import type { TConfSignalMessage } from '../domain/signaling-protocol';
import { parseConfSignalMessage } from '../domain/signaling-protocol';
import type { ParticipantId } from '../domain/types';

/** Connection lifecycle reported to subscribers. */
export type TConfSignalingConnectionState = 'idle' | 'connecting' | 'open' | 'closed';

export interface IConfSignalingClientParams {
  /** Communication-server-backed transport shared with retro. */
  readonly client: ICommunicationClient;
  /**
   * Logical room topic the conf feature maps to. Carried through
   * every published message so receivers can dispatch on the
   * correct room when more than one is active in the same socket
   * (only one is, today, but the topic keeps the wire format
   * symmetric with retro).
   */
  readonly topic: string;
  /** Participant id of the local client; used to drop self-echoes. */
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

/**
 * Wire envelope used to multiplex conf signaling messages on top
 * of the generic `signal:publish` event. Receivers ignore
 * envelopes whose `topic` does not match their own room — same
 * topic-routing pattern used by the retro y-webrtc adapter.
 */
interface IConfSignalEnvelope {
  readonly kind: 'conf-signal';
  readonly topic: string;
  readonly message: TConfSignalMessage;
}

function isConfSignalEnvelope(value: unknown): value is IConfSignalEnvelope {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const envelope = value as Record<string, unknown>;
  return (
    envelope.kind === 'conf-signal' &&
    typeof envelope.topic === 'string' &&
    typeof envelope.message === 'object' &&
    envelope.message !== null
  );
}

/**
 * Conf signaling adapter backed by the new
 * `CommunicationClient`. The previous implementation owned a raw
 * WebSocket and spoke the y-webrtc-style pub/sub directly — v1.1
 * delegates the transport to the shared communication client and
 * only keeps the conf-specific message validation here.
 *
 * Lifecycle:
 *  - Subscribes to `signal:event` on construction; tears down the
 *    listener in `dispose()`.
 *  - Mirrors the connection state observable so existing callers
 *    (and any future UI hooks) keep the same shape they had on
 *    the WebSocket implementation.
 *  - Drops messages whose `topic` does not match `params.topic`
 *    (cross-room safety) or whose `from` matches `self` (the
 *    server already filters self-echoes — this is belt-and-braces
 *    for proxies that may loop).
 */
export function createConfSignalingClient(
  params: IConfSignalingClientParams
): IConfSignalingClient {
  const { client, topic, self } = params;
  const messageListeners = new Set<TMessageListener>();
  const stateListeners = new Set<TStateListener>();
  let state: TConfSignalingConnectionState = client.state === 'open' ? 'open' : 'connecting';

  function setState(next: TConfSignalingConnectionState): void {
    if (state === next) {
      return;
    }
    state = next;
    for (const listener of stateListeners) {
      listener(next);
    }
  }

  // Outbound messages requested before the underlying socket finished
  // its handshake are buffered here and flushed on the first transition
  // to `'open'`. Without this guard, `runJoinFlow → publishHello`
  // (which fires the moment the join flow scheduled the publish, while
  // the Socket.IO client may still be in `'connecting'`) throws
  // `communication-client/not-connected`. Order is preserved by the
  // queue, and we silence any promise rejection from `signalPublish`
  // (e.g. if the connection drops between flush and ack arrival) — the
  // peer-state machine retries SDP / ICE on its own cadence.
  const pendingPublishes: TConfSignalMessage[] = [];

  function sendNow(message: TConfSignalMessage): void {
    const envelope: IConfSignalEnvelope = { kind: 'conf-signal', topic, message };
    client.signalPublish(envelope).catch(() => undefined);
  }

  function flushPending(): void {
    while (pendingPublishes.length > 0) {
      const message = pendingPublishes.shift();
      if (message === undefined) {
        break;
      }
      sendNow(message);
    }
  }

  const unsubscribeState = client.onConnectionStateChange(next => {
    switch (next) {
      case 'idle':
        setState('idle');
        return;
      case 'connecting':
        setState('connecting');
        return;
      case 'open':
        setState('open');
        flushPending();
        return;
      case 'closed':
        setState('closed');
        return;
    }
  });

  const unsubscribeSignal = client.onSignalEvent(event => {
    const envelope = event.payload;
    if (!isConfSignalEnvelope(envelope) || envelope.topic !== topic) {
      return;
    }
    const message = parseConfSignalMessage(envelope.message);
    if (message === null) {
      return;
    }
    if (message.from === self) {
      return;
    }
    for (const listener of messageListeners) {
      listener(message);
    }
  });

  let isDisposed = false;

  function publish(message: TConfSignalMessage): void {
    if (isDisposed) {
      return;
    }
    if (client.state !== 'open') {
      pendingPublishes.push(message);
      return;
    }
    sendNow(message);
  }

  function dispose(): void {
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
  }

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
    publish,
    dispose,
  };
}
