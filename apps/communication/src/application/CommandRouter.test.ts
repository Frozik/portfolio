import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Identity } from '../domain/Identity';
import type { IExecuteEvent, IInitiatePayload, IResponseEvent } from '../domain/protocol';
import type { RoomLimits } from '../domain/Room';
import { Room } from '../domain/Room';
import type { DisplayName, RoomId, SocketId, UserId } from '../domain/types';
import { CommandRouter } from './CommandRouter';
import type { IAuditLogger } from './ports/IAuditLogger';
import type {
  BroadcastRequestOptions,
  ICommandTransport,
  TransportAckResult,
} from './ports/ICommandTransport';
import type { IServerLogger } from './ports/IServerLogger';

const ROOM_ID = '11111111-2222-4333-8444-555555555555' as RoomId;
const ROOM_LIMITS: RoomLimits = { maxListeners: 50, maxTabsPerUser: 4 };

function makeIdentity(userId: string, socketId: string): Identity {
  return {
    userId: userId as UserId,
    displayName: `name-${userId}` as DisplayName,
    socketId,
  };
}

function makeLogger(): IServerLogger {
  const noop = (): void => undefined;
  const logger: IServerLogger = {
    info: noop,
    warn: noop,
    error: noop,
    debug: noop,
    child: () => logger,
  };
  return logger;
}

function makeAudit(): IAuditLogger & { calls: Array<{ event: string; fields: object }> } {
  const calls: Array<{ event: string; fields: object }> = [];
  return {
    calls,
    audit(event, fields) {
      calls.push({ event, fields });
    },
  };
}

// Programmable transport — push results into a per-iteration queue.
class FakeTransport implements ICommandTransport {
  public readonly emittedResponses: Array<{
    initiatorSocketId: SocketId;
    response: IResponseEvent;
  }> = [];
  public readonly broadcasts: Array<{
    roomId: RoomId;
    initiatorSocketId: SocketId;
    request: IExecuteEvent;
    options: BroadcastRequestOptions;
  }> = [];
  private programmed: AsyncIterable<TransportAckResult> | null = null;

  public program(stream: AsyncIterable<TransportAckResult>): void {
    this.programmed = stream;
  }

  public broadcastRequest(
    roomId: RoomId,
    initiatorSocketId: SocketId,
    request: IExecuteEvent,
    options: BroadcastRequestOptions
  ): AsyncIterable<TransportAckResult> {
    this.broadcasts.push({ roomId, initiatorSocketId, request, options });
    if (this.programmed === null) {
      throw new Error('FakeTransport: no program set');
    }
    const stream = this.programmed;
    this.programmed = null;
    return stream;
  }

  public emitResponse(initiatorSocketId: SocketId, response: IResponseEvent): void {
    this.emittedResponses.push({ initiatorSocketId, response });
  }
}

// Helper to build an async iterable from a static list, optionally with
// delays so we can interleave abort / advance.
async function* fromList(
  items: ReadonlyArray<TransportAckResult>
): AsyncIterable<TransportAckResult> {
  for (const item of items) {
    yield item;
  }
}

function buildPayload(correlationId = 'corr-1', command = 'do'): IInitiatePayload {
  return { command, correlationId, payload: { x: 1 } };
}

function buildRoom(memberSpecs: ReadonlyArray<{ userId: string; socketId: string }>): Room {
  const room = new Room(ROOM_ID, ROOM_LIMITS);
  for (const spec of memberSpecs) {
    room.addMember(spec.socketId, makeIdentity(spec.userId, spec.socketId));
  }
  return room;
}

describe('CommandRouter', () => {
  let transport: FakeTransport;
  let logger: IServerLogger;
  let audit: ReturnType<typeof makeAudit>;
  let router: CommandRouter;

  beforeEach(() => {
    transport = new FakeTransport();
    logger = makeLogger();
    audit = makeAudit();
    router = new CommandRouter({
      commandTransport: transport,
      logger,
      auditLogger: audit,
      maxInflightPerSocket: 2,
      responseTimeoutMs: 1_000,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('happy path: ack returns and both responders settle as success', async () => {
    const room = buildRoom([
      { userId: 'init', socketId: 'sock-init' },
      { userId: 'r1', socketId: 'sock-r1' },
      { userId: 'r2', socketId: 'sock-r2' },
    ]);
    transport.program(
      fromList([
        { kind: 'success', responderSocketId: 'sock-r1', payload: { ok: true } },
        { kind: 'success', responderSocketId: 'sock-r2', payload: { ok: true } },
      ])
    );

    const controller = new AbortController();
    const result = await router.routeInitiate({
      initiatorSocketId: 'sock-init',
      initiatorIdentity: makeIdentity('init', 'sock-init'),
      room,
      roomId: ROOM_ID,
      payload: buildPayload(),
      signal: controller.signal,
    });

    expect(result.ack.socketCount).toBe(3);
    expect(result.ack.users.map(u => u.userId).sort()).toEqual(['init', 'r1', 'r2']);

    // Wait for the fanout microtasks to flush.
    await new Promise<void>(resolve => queueMicrotask(resolve));
    await new Promise<void>(resolve => setImmediate(resolve));

    expect(transport.emittedResponses).toHaveLength(2);
    expect(transport.emittedResponses[0]?.response.kind).toBe('success');
    expect(transport.emittedResponses[1]?.response.kind).toBe('success');
    expect(transport.emittedResponses[0]?.response.responder?.userId).toBe('r1');
  });

  it('late-ack-after-timeout produces no second emit', async () => {
    const room = buildRoom([
      { userId: 'init', socketId: 'sock-init' },
      { userId: 'r1', socketId: 'sock-r1' },
    ]);
    transport.program(
      fromList([
        { kind: 'timeout', responderSocketId: 'sock-r1' },
        // The transport then SOMEHOW emits a late success for the same
        // responder. The router must drop it.
        { kind: 'success', responderSocketId: 'sock-r1', payload: { ok: true } },
      ])
    );

    await router.routeInitiate({
      initiatorSocketId: 'sock-init',
      initiatorIdentity: makeIdentity('init', 'sock-init'),
      room,
      roomId: ROOM_ID,
      payload: buildPayload('corr-late'),
      signal: new AbortController().signal,
    });
    await new Promise<void>(resolve => setImmediate(resolve));

    expect(transport.emittedResponses).toHaveLength(1);
    expect(transport.emittedResponses[0]?.response.kind).toBe('timeout');
  });

  it('responder-disconnected uses the snapshotted Identity', async () => {
    const room = buildRoom([
      { userId: 'init', socketId: 'sock-init' },
      { userId: 'r1', socketId: 'sock-r1' },
    ]);
    transport.program(fromList([{ kind: 'responder-disconnected', responderSocketId: 'sock-r1' }]));

    // Mutate room AFTER snapshot — the disconnected responder should still
    // be reflected in the response via the snapshot.
    const fanoutPromise = router.routeInitiate({
      initiatorSocketId: 'sock-init',
      initiatorIdentity: makeIdentity('init', 'sock-init'),
      room,
      roomId: ROOM_ID,
      payload: buildPayload('corr-disc'),
      signal: new AbortController().signal,
    });
    room.removeMember('sock-r1');
    await fanoutPromise;
    await new Promise<void>(resolve => setImmediate(resolve));

    expect(transport.emittedResponses).toHaveLength(1);
    const event = transport.emittedResponses[0]?.response;
    expect(event?.kind).toBe('responder-disconnected');
    expect(event?.responder?.userId).toBe('r1');
  });

  it('same correlationId twice from same socket settles independently', async () => {
    const room = buildRoom([
      { userId: 'init', socketId: 'sock-init' },
      { userId: 'r1', socketId: 'sock-r1' },
    ]);

    transport.program(
      fromList([{ kind: 'success', responderSocketId: 'sock-r1', payload: 'first' }])
    );
    await router.routeInitiate({
      initiatorSocketId: 'sock-init',
      initiatorIdentity: makeIdentity('init', 'sock-init'),
      room,
      roomId: ROOM_ID,
      payload: buildPayload('same-corr'),
      signal: new AbortController().signal,
    });
    await new Promise<void>(resolve => setImmediate(resolve));

    transport.program(
      fromList([{ kind: 'success', responderSocketId: 'sock-r1', payload: 'second' }])
    );
    await router.routeInitiate({
      initiatorSocketId: 'sock-init',
      initiatorIdentity: makeIdentity('init', 'sock-init'),
      room,
      roomId: ROOM_ID,
      payload: buildPayload('same-corr'),
      signal: new AbortController().signal,
    });
    await new Promise<void>(resolve => setImmediate(resolve));

    expect(transport.emittedResponses).toHaveLength(2);
    expect(transport.emittedResponses[0]?.response.payload).toBe('first');
    expect(transport.emittedResponses[1]?.response.payload).toBe('second');
  });

  it('rejects with kind=dispatch-rejected when over per-socket cap', async () => {
    const router2 = new CommandRouter({
      commandTransport: transport,
      logger,
      auditLogger: audit,
      maxInflightPerSocket: 1,
      responseTimeoutMs: 1_000,
    });

    const room = buildRoom([
      { userId: 'init', socketId: 'sock-init' },
      { userId: 'r1', socketId: 'sock-r1' },
    ]);

    // First dispatch: stream that never resolves so it stays in-flight.
    const resolveStreamHolder: { current: (() => void) | null } = { current: null };
    const blockingStream: AsyncIterable<TransportAckResult> = {
      [Symbol.asyncIterator]() {
        return {
          next: () =>
            new Promise<IteratorResult<TransportAckResult>>(resolve => {
              resolveStreamHolder.current = (): void => resolve({ value: undefined, done: true });
            }),
        };
      },
    };
    transport.program(blockingStream);

    await router2.routeInitiate({
      initiatorSocketId: 'sock-init',
      initiatorIdentity: makeIdentity('init', 'sock-init'),
      room,
      roomId: ROOM_ID,
      payload: buildPayload('corr-1'),
      signal: new AbortController().signal,
    });

    // Second dispatch should be rejected.
    const before = transport.emittedResponses.length;
    await router2.routeInitiate({
      initiatorSocketId: 'sock-init',
      initiatorIdentity: makeIdentity('init', 'sock-init'),
      room,
      roomId: ROOM_ID,
      payload: buildPayload('corr-2'),
      signal: new AbortController().signal,
    });

    expect(transport.emittedResponses.length).toBe(before + 1);
    const rejectEvent = transport.emittedResponses[before]?.response;
    expect(rejectEvent?.kind).toBe('dispatch-rejected');
    expect(rejectEvent?.reason).toBe('too-many-in-flight');

    // Cleanup the blocking stream.
    resolveStreamHolder.current?.();
  });

  it('signal.aborted mid-flight stops further emits', async () => {
    const room = buildRoom([
      { userId: 'init', socketId: 'sock-init' },
      { userId: 'r1', socketId: 'sock-r1' },
      { userId: 'r2', socketId: 'sock-r2' },
    ]);

    const controller = new AbortController();
    // Stream that yields one then signals abort before yielding the next.
    const stream: AsyncIterable<TransportAckResult> = {
      async *[Symbol.asyncIterator]() {
        yield { kind: 'success', responderSocketId: 'sock-r1', payload: 'first' };
        controller.abort();
        yield { kind: 'success', responderSocketId: 'sock-r2', payload: 'second' };
      },
    };
    transport.program(stream);

    await router.routeInitiate({
      initiatorSocketId: 'sock-init',
      initiatorIdentity: makeIdentity('init', 'sock-init'),
      room,
      roomId: ROOM_ID,
      payload: buildPayload('corr-abort'),
      signal: controller.signal,
    });
    await new Promise<void>(resolve => setImmediate(resolve));
    await new Promise<void>(resolve => setImmediate(resolve));

    expect(transport.emittedResponses).toHaveLength(1);
    expect(transport.emittedResponses[0]?.response.payload).toBe('first');
    expect(audit.calls.some(call => call.event === 'command.responses-dropped-after-abort')).toBe(
      true
    );
  });
});
