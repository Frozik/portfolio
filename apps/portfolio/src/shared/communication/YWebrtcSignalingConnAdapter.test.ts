import { BehaviorSubject } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ICommunicationClient,
  ISignalEvent,
  ITurnCredentials,
  TConnectionState,
  TSignalAck,
} from './CommunicationClient';
import {
  buildCommunicationSignalingUrl,
  installCommunicationWebSocketShim,
  registerCommunicationSignaling,
} from './YWebrtcSignalingConnAdapter';

interface IFakeClient extends ICommunicationClient {
  triggerSignal(event: ISignalEvent): void;
  publishedPayloads: unknown[];
}

function createFakeClient(): IFakeClient {
  const signalListeners = new Set<(event: ISignalEvent) => void>();
  const stateListeners = new Set<(state: TConnectionState) => void>();
  const stateSubject = new BehaviorSubject<TConnectionState>('open');
  const publishedPayloads: unknown[] = [];
  return {
    state: 'open',
    state$: stateSubject.asObservable(),
    connect() {
      // no-op
    },
    disconnect() {
      // no-op
    },
    signalPublish(payload: unknown): Promise<TSignalAck> {
      publishedPayloads.push(payload);
      return Promise.resolve({ ok: true, recipientCount: 1 });
    },
    requestTurnCredentials(): Promise<ITurnCredentials> {
      return Promise.resolve({
        username: 'u',
        credential: 'c',
        ttl: 3600,
        urls: ['turn:example:3478'],
      });
    },
    onSignalEvent(listener) {
      signalListeners.add(listener);
      return () => {
        signalListeners.delete(listener);
      };
    },
    onRoomPresence() {
      return () => {
        // no-op
      };
    },
    onTokenExpiring() {
      return () => {
        // no-op
      };
    },
    onTokenExpired() {
      return () => {
        // no-op
      };
    },
    onServerDraining() {
      return () => {
        // no-op
      };
    },
    onTurnCredentialsRenewed() {
      return () => {
        // no-op
      };
    },
    onConnectionStateChange(listener) {
      stateListeners.add(listener);
      return () => {
        stateListeners.delete(listener);
      };
    },
    triggerSignal(event) {
      for (const listener of signalListeners) {
        listener(event);
      }
    },
    publishedPayloads,
  };
}

describe('YWebrtcSignalingConnAdapter', () => {
  beforeEach(() => {
    installCommunicationWebSocketShim();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('routes a y-webrtc-style publish envelope through CommunicationClient.signalPublish', () => {
    const fake = createFakeClient();
    const teardown = registerCommunicationSignaling({
      token: 'token-publish',
      topic: 'frozik-retro-room1',
      client: fake,
    });
    const url = buildCommunicationSignalingUrl('token-publish');
    const Native = (globalThis as unknown as { WebSocket: new (url: string) => unknown }).WebSocket;
    const socket = new Native(url) as unknown as {
      send: (raw: string) => void;
    };
    socket.send(
      JSON.stringify({ type: 'publish', topic: 'frozik-retro-room1', data: { kind: 'announce' } })
    );
    expect(fake.publishedPayloads).toEqual([{ kind: 'announce' }]);
    teardown();
  });

  it('delivers inbound signal:event payloads as y-webrtc publish envelopes', async () => {
    const fake = createFakeClient();
    const teardown = registerCommunicationSignaling({
      token: 'token-inbound',
      topic: 'frozik-retro-room2',
      client: fake,
    });
    const url = buildCommunicationSignalingUrl('token-inbound');
    const Native = (globalThis as unknown as { WebSocket: new (url: string) => unknown }).WebSocket;
    const socket = new Native(url) as unknown as {
      onmessage: ((event: MessageEvent<string>) => void) | null;
    };
    const received: string[] = [];
    socket.onmessage = event => {
      received.push(event.data);
    };
    fake.triggerSignal({
      payload: { kind: 'demo' },
      from: { userId: 'u', displayName: 'd', socketId: 's' },
    });
    expect(received).toHaveLength(1);
    const parsed = JSON.parse(received[0]) as {
      type: string;
      topic: string;
      data: { kind: string };
    };
    expect(parsed).toEqual({
      type: 'publish',
      topic: 'frozik-retro-room2',
      data: { kind: 'demo' },
    });
    teardown();
  });

  it('returns a permanently-closed stub when constructed without a registration', async () => {
    const url = buildCommunicationSignalingUrl('never-registered');
    const Native = (globalThis as unknown as { WebSocket: new (url: string) => unknown }).WebSocket;
    const socket = new Native(url) as unknown as {
      readyState: number;
      onclose: ((event: Event) => void) | null;
    };
    expect(socket.readyState).toBe(3);
    // Synthetic `onclose` fires on the next microtask so the caller
    // (lib0 `setupWS`) can attach its own handler before we dispatch.
    let closed = false;
    socket.onclose = () => {
      closed = true;
    };
    await Promise.resolve();
    expect(closed).toBe(true);
  });

  it('answers ping with a pong locally to keep lib0 watchdogs happy', () => {
    const fake = createFakeClient();
    const teardown = registerCommunicationSignaling({
      token: 'token-ping',
      topic: 'frozik-retro-room3',
      client: fake,
    });
    const url = buildCommunicationSignalingUrl('token-ping');
    const Native = (globalThis as unknown as { WebSocket: new (url: string) => unknown }).WebSocket;
    const socket = new Native(url) as unknown as {
      onmessage: ((event: MessageEvent<string>) => void) | null;
      send: (raw: string) => void;
    };
    const received: string[] = [];
    socket.onmessage = event => {
      received.push(event.data);
    };
    socket.send(JSON.stringify({ type: 'ping' }));
    expect(received).toHaveLength(1);
    const parsed = JSON.parse(received[0]) as { type: string };
    expect(parsed.type).toBe('pong');
    teardown();
  });

  it('teardown closes any live mock sockets', () => {
    const fake = createFakeClient();
    const teardown = registerCommunicationSignaling({
      token: 'token-teardown',
      topic: 'frozik-retro-room4',
      client: fake,
    });
    const url = buildCommunicationSignalingUrl('token-teardown');
    const Native = (globalThis as unknown as { WebSocket: new (url: string) => unknown }).WebSocket;
    const socket = new Native(url) as unknown as {
      readyState: number;
      send: (raw: string) => void;
    };
    teardown();
    // After teardown, the previous registration is gone and the shim
    // returns a permanently-closed stub for subsequent constructions
    // — throwing past lib0's `setupWS` setTimeout boundary would
    // otherwise propagate as an uncaught browser-console error.
    const next = new Native(url) as unknown as { readyState: number };
    expect(next.readyState).toBe(3);
    // The previously-built socket has been forced closed.
    expect(socket.readyState).toBe(3);
  });
});
