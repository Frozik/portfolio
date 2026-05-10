import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type TListener = (...args: unknown[]) => void;

interface IFakeSocket {
  connected: boolean;
  on(event: string, listener: TListener): IFakeSocket;
  off(event: string, listener?: TListener): IFakeSocket;
  emit(event: string, ...args: unknown[]): IFakeSocket;
  removeAllListeners(): IFakeSocket;
  disconnect(): IFakeSocket;
  timeout(ms: number): IFakeSocket;
  trigger(event: string, ...args: unknown[]): void;
  listeners: Map<string, Set<TListener>>;
  emitted: Array<{
    readonly event: string;
    readonly args: ReadonlyArray<unknown>;
  }>;
  ackHandler: ((event: string, args: unknown[]) => unknown | { error: Error } | null) | null;
}

const fakeSocket: IFakeSocket = {
  connected: true,
  listeners: new Map<string, Set<TListener>>(),
  emitted: [],
  ackHandler: null,
  on(event, listener) {
    let bucket = this.listeners.get(event);
    if (bucket === undefined) {
      bucket = new Set<TListener>();
      this.listeners.set(event, bucket);
    }
    bucket.add(listener);
    return this;
  },
  off(event, listener) {
    const bucket = this.listeners.get(event);
    if (bucket === undefined) {
      return this;
    }
    if (listener === undefined) {
      bucket.clear();
    } else {
      bucket.delete(listener);
    }
    return this;
  },
  emit(event, ...args) {
    this.emitted.push({ event, args });
    if (this.ackHandler !== null && typeof args[args.length - 1] === 'function') {
      const ack = args[args.length - 1] as (...resp: unknown[]) => void;
      const result = this.ackHandler(event, args.slice(0, -1));
      if (result !== null && typeof result === 'object' && 'error' in result) {
        ack((result as { error: Error }).error, undefined);
      } else {
        ack(null, result);
      }
    }
    return this;
  },
  removeAllListeners() {
    this.listeners.clear();
    return this;
  },
  disconnect() {
    this.connected = false;
    return this;
  },
  timeout() {
    return this;
  },
  trigger(event, ...args) {
    const bucket = this.listeners.get(event);
    if (bucket === undefined) {
      return;
    }
    for (const listener of bucket) {
      listener(...args);
    }
  },
};

const ioMock = vi.fn();

vi.mock('socket.io-client', () => ({
  io: (...args: unknown[]) => {
    ioMock(...args);
    fakeSocket.connected = true;
    return fakeSocket;
  },
}));

import { createCommunicationClient } from './CommunicationClient';

describe('CommunicationClient', () => {
  beforeEach(() => {
    fakeSocket.listeners.clear();
    fakeSocket.emitted.length = 0;
    fakeSocket.ackHandler = null;
    fakeSocket.connected = true;
    ioMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('does not open a socket when the user is signed out', () => {
    const client = createCommunicationClient({
      baseUrl: 'http://server',
      roomId: 'r1',
      getCredentials: () => null,
      onTokenRefreshNeeded: () => Promise.resolve(null),
    });
    client.connect();
    expect(ioMock).not.toHaveBeenCalled();
  });

  it('passes roomId + provider + token in the Socket.IO handshake', () => {
    const client = createCommunicationClient({
      baseUrl: 'http://server',
      roomId: 'room-7',
      getCredentials: () => ({ provider: 'google', token: 'tok-1' }),
      onTokenRefreshNeeded: () => Promise.resolve(null),
    });
    client.connect();
    expect(ioMock).toHaveBeenCalledTimes(1);
    const args = ioMock.mock.calls[0];
    expect(args[0]).toBe('http://server');
    expect(args[1]).toMatchObject({
      auth: { roomId: 'room-7', provider: 'google', token: 'tok-1' },
    });
  });

  it('forwards inbound signal:event to subscribers', () => {
    const client = createCommunicationClient({
      baseUrl: 'http://server',
      roomId: 'r1',
      getCredentials: () => ({ provider: 'google', token: 'tok' }),
      onTokenRefreshNeeded: () => Promise.resolve(null),
    });
    client.connect();
    const received: unknown[] = [];
    client.onSignalEvent(event => received.push(event));
    fakeSocket.trigger('signal:event', {
      payload: { kind: 'demo' },
      from: { userId: 'u1', displayName: 'X', socketId: 's1' },
    });
    expect(received).toHaveLength(1);
    expect((received[0] as { payload: { kind: string } }).payload.kind).toBe('demo');
  });

  it('resolves signalPublish with the server ack', async () => {
    const client = createCommunicationClient({
      baseUrl: 'http://server',
      roomId: 'r1',
      getCredentials: () => ({ provider: 'google', token: 'tok' }),
      onTokenRefreshNeeded: () => Promise.resolve(null),
    });
    client.connect();
    fakeSocket.ackHandler = (event, args) => {
      expect(event).toBe('signal:publish');
      expect(args[0]).toEqual({ payload: { kind: 'hi' }, correlationId: 'c1' });
      return { ok: true, recipientCount: 2 };
    };
    const ack = await client.signalPublish({ kind: 'hi' }, 'c1');
    expect(ack).toEqual({ ok: true, recipientCount: 2 });
  });

  it('rejects signalPublish when the socket is not connected', async () => {
    const client = createCommunicationClient({
      baseUrl: 'http://server',
      roomId: 'r1',
      getCredentials: () => ({ provider: 'google', token: 'tok' }),
      onTokenRefreshNeeded: () => Promise.resolve(null),
    });
    client.connect();
    fakeSocket.connected = false;
    await expect(client.signalPublish({})).rejects.toThrow('not-connected');
  });

  it('resolves requestTurnCredentials with the issued credentials', async () => {
    const client = createCommunicationClient({
      baseUrl: 'http://server',
      roomId: 'r1',
      getCredentials: () => ({ provider: 'google', token: 'tok' }),
      onTokenRefreshNeeded: () => Promise.resolve(null),
    });
    client.connect();
    fakeSocket.ackHandler = event => {
      expect(event).toBe('turn:request-credentials');
      return {
        username: 'u',
        credential: 'p',
        ttl: 3600,
        urls: ['turn:host:3478'],
      };
    };
    const creds = await client.requestTurnCredentials();
    expect(creds.urls).toEqual(['turn:host:3478']);
    expect(creds.username).toBe('u');
    expect(creds.credential).toBe('p');
  });

  it('emits an auth:refresh-token round-trip on auth:token-expiring', async () => {
    const refresh = vi.fn().mockResolvedValue('new-token');
    const client = createCommunicationClient({
      baseUrl: 'http://server',
      roomId: 'r1',
      getCredentials: () => ({ provider: 'google', token: 'tok' }),
      onTokenRefreshNeeded: refresh,
    });
    client.connect();
    fakeSocket.ackHandler = event =>
      event === 'auth:refresh-token' ? { ok: true, expiresAt: '' } : null;

    fakeSocket.trigger('auth:token-expiring', { expiresAt: '', secondsRemaining: 30 });
    // Microtask flush.
    await Promise.resolve();
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(1);
    const refreshEmit = fakeSocket.emitted.find(call => call.event === 'auth:refresh-token');
    expect(refreshEmit).toBeDefined();
    expect(refreshEmit?.args[0]).toEqual({ token: 'new-token' });
  });

  it('skips the refresh emit when the host returns null', async () => {
    const refresh = vi.fn().mockResolvedValue(null);
    const client = createCommunicationClient({
      baseUrl: 'http://server',
      roomId: 'r1',
      getCredentials: () => ({ provider: 'google', token: 'tok' }),
      onTokenRefreshNeeded: refresh,
    });
    client.connect();
    fakeSocket.trigger('auth:token-expiring', { expiresAt: '', secondsRemaining: 30 });
    await Promise.resolve();
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fakeSocket.emitted.find(call => call.event === 'auth:refresh-token')).toBeUndefined();
  });

  it('updates connection state on connect / disconnect events', () => {
    const client = createCommunicationClient({
      baseUrl: 'http://server',
      roomId: 'r1',
      getCredentials: () => ({ provider: 'google', token: 'tok' }),
      onTokenRefreshNeeded: () => Promise.resolve(null),
    });
    const states: string[] = [];
    client.onConnectionStateChange(state => states.push(state));
    client.connect();
    fakeSocket.trigger('connect');
    fakeSocket.trigger('disconnect');
    expect(states).toEqual(['connecting', 'open', 'closed']);
  });

  it('fires onTurnCredentialsRenewed when the server emits turn:credentials-renewed', () => {
    const client = createCommunicationClient({
      baseUrl: 'http://server',
      roomId: 'r1',
      getCredentials: () => ({ provider: 'google', token: 'tok' }),
      onTokenRefreshNeeded: () => Promise.resolve(null),
    });
    client.connect();
    let renewedCount = 0;
    client.onTurnCredentialsRenewed(() => {
      renewedCount += 1;
    });
    fakeSocket.trigger('turn:credentials-renewed', {});
    fakeSocket.trigger('turn:credentials-renewed', {});
    expect(renewedCount).toBe(2);
  });
});
