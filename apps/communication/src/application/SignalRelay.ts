import type { ISignalEventOutbound } from '@frozik/communication-protocol/messages';
import { Temporal } from 'temporal-polyfill';
import { InvalidPayloadError } from '../domain/errors';
import type { Identity } from '../domain/Identity';
import type { IRoomRegistry } from '../domain/IRoomRegistry';
import {
  parseSignalPublishPayload,
  SIGNAL_PAYLOAD_NULL,
  SIGNAL_PAYLOAD_TOO_LARGE,
} from '../domain/protocol-validators';
import type { SignalAck } from '../domain/Signal';
import type { RoomId, SocketId } from '../domain/types';
import type { ISignalTransport } from './ports/ISignalTransport';

const MS_PER_SECOND = 1_000;

type SignalRelayDeps = {
  signalTransport: ISignalTransport;
  roomRegistry: IRoomRegistry;
  ratePerSec: number;
  burst: number;
  /** Maximum JSON-serialized `signal:publish` payload size accepted, bytes. */
  payloadMaxBytes: number;
};

type Bucket = {
  tokens: number;
  lastRefillMs: number;
};

export class SignalRelay {
  private readonly buckets = new Map<SocketId, Bucket>();

  public constructor(private readonly deps: SignalRelayDeps) {}

  public async relay(
    socketId: SocketId,
    identity: Identity,
    roomId: RoomId,
    raw: unknown
  ): Promise<SignalAck> {
    let parsed: ReturnType<typeof parseSignalPublishPayload>;
    try {
      parsed = parseSignalPublishPayload(raw, this.deps.payloadMaxBytes);
    } catch (caught) {
      if (caught instanceof InvalidPayloadError) {
        if (caught.message === SIGNAL_PAYLOAD_TOO_LARGE) {
          return { ok: false, error: 'payload-too-large' };
        }
        if (caught.message === SIGNAL_PAYLOAD_NULL) {
          return { ok: false, error: 'invalid-payload' };
        }
        return { ok: false, error: 'invalid-payload' };
      }
      return { ok: false, error: 'internal' };
    }

    if (!this.consumeToken(socketId)) {
      return { ok: false, error: 'rate-limited' };
    }

    const room = this.deps.roomRegistry.getRoom(roomId);
    if (room === null) {
      return { ok: false, error: 'not-in-room' };
    }

    const outbound: ISignalEventOutbound = {
      payload: parsed.payload,
      from: {
        userId: identity.userId,
        displayName: identity.displayName,
        socketId,
      },
      correlationId: parsed.correlationId,
    };

    try {
      const result = await this.deps.signalTransport.broadcastSignalEvent(
        roomId,
        socketId,
        outbound
      );
      return { ok: true, recipientCount: result.recipientCount };
    } catch (_caught) {
      return { ok: false, error: 'internal' };
    }
  }

  public dispose(): void {
    this.buckets.clear();
  }

  /**
   * Drop the rate-limit bucket for a disconnected socket. Without this the
   * `buckets` Map grows unbounded over the server's lifetime as sockets come
   * and go.
   */
  public releaseSocket(socketId: SocketId): void {
    this.buckets.delete(socketId);
  }

  /**
   * Test/diagnostic accessor exposing the current count of tracked sockets
   * without leaking the internal Map.
   */
  public getBucketCount(): number {
    return this.buckets.size;
  }

  private consumeToken(socketId: SocketId): boolean {
    const nowMs = Temporal.Now.instant().epochMilliseconds;
    const bucket = this.buckets.get(socketId) ?? {
      tokens: this.deps.burst,
      lastRefillMs: nowMs,
    };
    const elapsedMs = nowMs - bucket.lastRefillMs;
    const refilled = Math.min(
      this.deps.burst,
      bucket.tokens + (elapsedMs * this.deps.ratePerSec) / MS_PER_SECOND
    );
    if (refilled < 1) {
      this.buckets.set(socketId, { tokens: refilled, lastRefillMs: nowMs });
      return false;
    }
    this.buckets.set(socketId, { tokens: refilled - 1, lastRefillMs: nowMs });
    return true;
  }
}
