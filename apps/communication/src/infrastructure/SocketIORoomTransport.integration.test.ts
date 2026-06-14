// @vitest-environment node
import type { Server as HttpServer } from 'node:http';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import {
  COMMAND_EXECUTE,
  ROOM_PRESENCE,
  SIGNAL_EVENT,
} from '@frozik/communication-protocol/events';
import type {
  IExecuteEvent,
  IRoomPresenceEvent,
  ISignalEventOutbound,
} from '@frozik/communication-protocol/messages';
import { Server as SocketIOServer } from 'socket.io';
import type { Socket as ClientSocket } from 'socket.io-client';
import { io as ioClient } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { RoomId } from '../domain/types';
import { SocketIORoomTransport } from './SocketIORoomTransport';

const ROOM_ID = '550e8400-e29b-41d4-a716-446655440000' as RoomId;
const TEST_TIMEOUT_MS = 500;
const HANDSHAKE_TIMEOUT_MS = 1500;

type Harness = {
  httpServer: HttpServer;
  io: SocketIOServer;
  transport: SocketIORoomTransport;
  port: number;
};

async function startServer(): Promise<Harness> {
  const httpServer = createServer();
  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*' },
  });
  await new Promise<void>(resolve => {
    httpServer.listen(0, '127.0.0.1', () => {
      resolve();
    });
  });
  const address = httpServer.address() as AddressInfo;
  return {
    httpServer,
    io,
    transport: new SocketIORoomTransport(io),
    port: address.port,
  };
}

async function stopServer(harness: Harness): Promise<void> {
  // SocketIOServer.close() also closes the underlying http server it's
  // attached to, so closing the http server explicitly afterwards would
  // throw ERR_SERVER_NOT_RUNNING.
  await new Promise<void>(resolve => {
    harness.io.close(() => {
      resolve();
    });
  });
}

function connectClient(port: number): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const client = ioClient(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    const timeout = setTimeout(() => {
      client.disconnect();
      reject(new Error('client connect timeout'));
    }, HANDSHAKE_TIMEOUT_MS);
    client.on('connect', () => {
      clearTimeout(timeout);
      resolve(client);
    });
    client.on('connect_error', error => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

// Wait until the server has registered at least `expected` sockets in the
// target room. Without this, calling `broadcastRequest` immediately after
// client `connect` can race the socket joining the room.
async function waitForRoomSize(harness: Harness, expected: number): Promise<void> {
  const deadline = Date.now() + HANDSHAKE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const sockets = await harness.io.in(ROOM_ID).fetchSockets();
    if (sockets.length >= expected) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error(`room never reached size ${expected}`);
}

async function joinRoom(harness: Harness, client: ClientSocket): Promise<string> {
  const serverSocket = harness.io.sockets.sockets.get(client.id ?? '');
  if (serverSocket === undefined) {
    throw new Error('server socket not yet registered');
  }
  await serverSocket.join(ROOM_ID);
  return serverSocket.id;
}

function buildExecuteEvent(): IExecuteEvent {
  return {
    command: 'test:cmd',
    payload: { value: 1 },
    correlationId: 'corr-1',
    initiator: { userId: 'user-1', displayName: 'User One', socketId: 'init-sock' },
  };
}

describe('SocketIORoomTransport (integration)', () => {
  let harness: Harness;

  beforeEach(async () => {
    harness = await startServer();
  });

  afterEach(async () => {
    await stopServer(harness);
  });

  it('broadcastRequest yields one success per responder that acks', async () => {
    const initiator = await connectClient(harness.port);
    const responderA = await connectClient(harness.port);
    const responderB = await connectClient(harness.port);

    const initiatorSid = await joinRoom(harness, initiator);
    await joinRoom(harness, responderA);
    await joinRoom(harness, responderB);
    await waitForRoomSize(harness, 3);

    responderA.on(COMMAND_EXECUTE, (_event, ack) => ack({ payload: 'A', correlationId: 'corr-1' }));
    responderB.on(COMMAND_EXECUTE, (_event, ack) => ack({ payload: 'B', correlationId: 'corr-1' }));

    const controller = new AbortController();
    const results: Array<{ kind: string; payload?: unknown }> = [];
    for await (const result of harness.transport.broadcastRequest(
      ROOM_ID,
      initiatorSid,
      buildExecuteEvent(),
      { signal: controller.signal, timeoutMs: TEST_TIMEOUT_MS }
    )) {
      results.push(
        result.kind === 'success'
          ? { kind: result.kind, payload: result.payload }
          : { kind: result.kind }
      );
    }

    expect(results).toHaveLength(2);
    expect(results.every(result => result.kind === 'success')).toBe(true);
    const payloads = results.map(result => result.payload).sort();
    expect(payloads).toEqual(['A', 'B']);

    initiator.disconnect();
    responderA.disconnect();
    responderB.disconnect();
  });

  it('broadcastRequest yields timeout for non-acking responder', async () => {
    const initiator = await connectClient(harness.port);
    const responder = await connectClient(harness.port);

    const initiatorSid = await joinRoom(harness, initiator);
    await joinRoom(harness, responder);
    await waitForRoomSize(harness, 2);

    // Responder ignores the event — no ack will be sent.

    const controller = new AbortController();
    const results: Array<{ kind: string }> = [];
    for await (const result of harness.transport.broadcastRequest(
      ROOM_ID,
      initiatorSid,
      buildExecuteEvent(),
      { signal: controller.signal, timeoutMs: 100 }
    )) {
      results.push({ kind: result.kind });
    }

    expect(results).toEqual([{ kind: 'timeout' }]);

    initiator.disconnect();
    responder.disconnect();
  });

  it('broadcastRequest yields responder-disconnected when responder drops mid-flight', async () => {
    const initiator = await connectClient(harness.port);
    const responder = await connectClient(harness.port);

    const initiatorSid = await joinRoom(harness, initiator);
    await joinRoom(harness, responder);
    await waitForRoomSize(harness, 2);

    // Disconnect the responder right after it receives the event.
    responder.on(COMMAND_EXECUTE, () => {
      responder.disconnect();
    });

    const controller = new AbortController();
    const results: Array<{ kind: string }> = [];
    for await (const result of harness.transport.broadcastRequest(
      ROOM_ID,
      initiatorSid,
      buildExecuteEvent(),
      { signal: controller.signal, timeoutMs: TEST_TIMEOUT_MS }
    )) {
      results.push({ kind: result.kind });
    }

    expect(results).toHaveLength(1);
    expect(['responder-disconnected', 'timeout']).toContain(results[0].kind);

    initiator.disconnect();
  });

  it('broadcastSignalEvent delivers to every other socket in the room', async () => {
    const sender = await connectClient(harness.port);
    const recipientA = await connectClient(harness.port);
    const recipientB = await connectClient(harness.port);

    const senderSid = await joinRoom(harness, sender);
    await joinRoom(harness, recipientA);
    await joinRoom(harness, recipientB);
    await waitForRoomSize(harness, 3);

    const receivedA = new Promise<ISignalEventOutbound>(resolve => {
      recipientA.once(SIGNAL_EVENT, payload => resolve(payload));
    });
    const receivedB = new Promise<ISignalEventOutbound>(resolve => {
      recipientB.once(SIGNAL_EVENT, payload => resolve(payload));
    });

    const event: ISignalEventOutbound = {
      payload: { sdp: 'offer' },
      from: { userId: 'u1', displayName: 'U1', socketId: senderSid },
    };
    const result = await harness.transport.broadcastSignalEvent(ROOM_ID, senderSid, event);
    expect(result.recipientCount).toBe(2);
    const a = await receivedA;
    const b = await receivedB;
    expect(a.payload).toEqual({ sdp: 'offer' });
    expect(b.payload).toEqual({ sdp: 'offer' });

    sender.disconnect();
    recipientA.disconnect();
    recipientB.disconnect();
  });

  it('emitPresence delivers to all sockets in the room (including the trigger)', async () => {
    const memberA = await connectClient(harness.port);
    const memberB = await connectClient(harness.port);
    await joinRoom(harness, memberA);
    await joinRoom(harness, memberB);
    await waitForRoomSize(harness, 2);

    const receivedA = new Promise<IRoomPresenceEvent>(resolve => {
      memberA.once(ROOM_PRESENCE, payload => resolve(payload));
    });
    const receivedB = new Promise<IRoomPresenceEvent>(resolve => {
      memberB.once(ROOM_PRESENCE, payload => resolve(payload));
    });

    const event: IRoomPresenceEvent = {
      socketCount: 2,
      users: [
        { userId: 'u1', displayName: 'U1' },
        { userId: 'u2', displayName: 'U2' },
      ],
    };
    harness.transport.emitPresence(ROOM_ID, event);

    expect((await receivedA).socketCount).toBe(2);
    expect((await receivedB).socketCount).toBe(2);

    memberA.disconnect();
    memberB.disconnect();
  });

  it('aborting mid-iteration terminates the AsyncIterable', async () => {
    const initiator = await connectClient(harness.port);
    const slow = await connectClient(harness.port);

    const initiatorSid = await joinRoom(harness, initiator);
    await joinRoom(harness, slow);
    await waitForRoomSize(harness, 2);

    const controller = new AbortController();
    const iterable = harness.transport.broadcastRequest(
      ROOM_ID,
      initiatorSid,
      buildExecuteEvent(),
      { signal: controller.signal, timeoutMs: 5000 }
    );

    // Abort right away — the slow responder will surface as
    // responder-disconnected via the abort handler.
    setTimeout(() => controller.abort(), 20);

    const results: Array<{ kind: string }> = [];
    for await (const result of iterable) {
      results.push({ kind: result.kind });
    }

    // We may receive 0 or 1 results depending on race timing; the loop must
    // terminate either way.
    expect(results.length).toBeLessThanOrEqual(1);

    initiator.disconnect();
    slow.disconnect();
  });
});
