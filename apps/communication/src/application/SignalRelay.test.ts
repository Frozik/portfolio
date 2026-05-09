import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Identity } from '../domain/Identity';
import type { IRoomRegistry } from '../domain/IRoomRegistry';
import { MAX_SIGNAL_PAYLOAD_BYTES } from '../domain/protocol-validators';
import type { RoomLimits } from '../domain/Room';
import { Room } from '../domain/Room';
import type { DisplayName, RoomId, UserId } from '../domain/types';
import type { ISignalTransport } from './ports/ISignalTransport';
import { SignalRelay } from './SignalRelay';

const ROOM_ID = '11111111-2222-4333-8444-555555555555' as RoomId;
const ROOM_LIMITS: RoomLimits = { maxListeners: 10, maxTabsPerUser: 4 };

const identity: Identity = {
  userId: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee' as UserId,
  displayName: 'Alice' as DisplayName,
  socketId: 'sock-1',
};

function makeRegistry(seedRoom = true): IRoomRegistry {
  const room = new Room(ROOM_ID, ROOM_LIMITS);
  return {
    ensure: () => room,
    release: () => undefined,
    getRoom: () => (seedRoom ? room : null),
    count: () => (seedRoom ? 1 : 0),
  };
}

function makeTransport(): ISignalTransport & {
  calls: Array<{ roomId: RoomId; from: string; payload: unknown }>;
  fail: boolean;
} {
  const calls: Array<{ roomId: RoomId; from: string; payload: unknown }> = [];
  return {
    calls,
    fail: false,
    async broadcastSignalEvent(roomId, fromSocketId, event) {
      if (this.fail) {
        throw new Error('boom');
      }
      calls.push({ roomId, from: fromSocketId, payload: event.payload });
      return { recipientCount: 2 };
    },
  };
}

describe('SignalRelay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1_700_000_000_000));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('happy path returns ok with recipientCount', async () => {
    const transport = makeTransport();
    const relay = new SignalRelay({
      signalTransport: transport,
      roomRegistry: makeRegistry(true),
      ratePerSec: 10,
      burst: 5,
      payloadMaxBytes: MAX_SIGNAL_PAYLOAD_BYTES,
    });
    const ack = await relay.relay('sock-1', identity, ROOM_ID, {
      payload: { sdp: 'offer' },
    });
    expect(ack).toEqual({ ok: true, recipientCount: 2 });
    expect(transport.calls).toHaveLength(1);
  });

  it('rejects oversized payload with payload-too-large', async () => {
    const transport = makeTransport();
    const relay = new SignalRelay({
      signalTransport: transport,
      roomRegistry: makeRegistry(true),
      ratePerSec: 10,
      burst: 5,
      payloadMaxBytes: MAX_SIGNAL_PAYLOAD_BYTES,
    });
    const big = 'x'.repeat(MAX_SIGNAL_PAYLOAD_BYTES + 100);
    const ack = await relay.relay('sock-1', identity, ROOM_ID, {
      payload: { big },
    });
    expect(ack).toEqual({ ok: false, error: 'payload-too-large' });
    expect(transport.calls).toHaveLength(0);
  });

  it('rejects null payload with invalid-payload', async () => {
    const transport = makeTransport();
    const relay = new SignalRelay({
      signalTransport: transport,
      roomRegistry: makeRegistry(true),
      ratePerSec: 10,
      burst: 5,
      payloadMaxBytes: MAX_SIGNAL_PAYLOAD_BYTES,
    });
    const ack = await relay.relay('sock-1', identity, ROOM_ID, { payload: null });
    expect(ack).toEqual({ ok: false, error: 'invalid-payload' });
  });

  it('rate-limits after the burst is exhausted', async () => {
    const transport = makeTransport();
    const relay = new SignalRelay({
      signalTransport: transport,
      roomRegistry: makeRegistry(true),
      ratePerSec: 1,
      burst: 2,
      payloadMaxBytes: MAX_SIGNAL_PAYLOAD_BYTES,
    });
    expect((await relay.relay('sock-1', identity, ROOM_ID, { payload: { x: 1 } })).ok).toBe(true);
    expect((await relay.relay('sock-1', identity, ROOM_ID, { payload: { x: 1 } })).ok).toBe(true);
    const blocked = await relay.relay('sock-1', identity, ROOM_ID, {
      payload: { x: 1 },
    });
    expect(blocked).toEqual({ ok: false, error: 'rate-limited' });
    expect(transport.calls).toHaveLength(2);
  });

  it('refills the bucket as time passes', async () => {
    const transport = makeTransport();
    const relay = new SignalRelay({
      signalTransport: transport,
      roomRegistry: makeRegistry(true),
      ratePerSec: 1,
      burst: 1,
      payloadMaxBytes: MAX_SIGNAL_PAYLOAD_BYTES,
    });
    expect((await relay.relay('sock-1', identity, ROOM_ID, { payload: { x: 1 } })).ok).toBe(true);
    expect((await relay.relay('sock-1', identity, ROOM_ID, { payload: { x: 1 } })).ok).toBe(false);
    vi.advanceTimersByTime(1_500);
    expect((await relay.relay('sock-1', identity, ROOM_ID, { payload: { x: 1 } })).ok).toBe(true);
  });

  it('returns not-in-room when room does not exist', async () => {
    const transport = makeTransport();
    const relay = new SignalRelay({
      signalTransport: transport,
      roomRegistry: makeRegistry(false),
      ratePerSec: 10,
      burst: 5,
      payloadMaxBytes: MAX_SIGNAL_PAYLOAD_BYTES,
    });
    const ack = await relay.relay('sock-1', identity, ROOM_ID, {
      payload: { x: 1 },
    });
    expect(ack).toEqual({ ok: false, error: 'not-in-room' });
  });

  it('returns internal on transport failure', async () => {
    const transport = makeTransport();
    transport.fail = true;
    const relay = new SignalRelay({
      signalTransport: transport,
      roomRegistry: makeRegistry(true),
      ratePerSec: 10,
      burst: 5,
      payloadMaxBytes: MAX_SIGNAL_PAYLOAD_BYTES,
    });
    const ack = await relay.relay('sock-1', identity, ROOM_ID, {
      payload: { x: 1 },
    });
    expect(ack).toEqual({ ok: false, error: 'internal' });
  });
});
