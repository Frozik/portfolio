import { describe, expect, it } from 'vitest';
import { InvalidPayloadError } from './errors';
import {
  MAX_SIGNAL_PAYLOAD_BYTES,
  parseExecuteAck,
  parseExecuteEvent,
  parseHandshakeAuth,
  parseInitiateAck,
  parseInitiatePayload,
  parseRefreshTokenAck,
  parseRefreshTokenPayload,
  parseResponseEvent,
  parseRoomPresenceEvent,
  parseServerDrainingEvent,
  parseSignalAck,
  parseSignalEventOutbound,
  parseSignalPublishPayload,
  parseTokenExpiringEvent,
  parseTurnCredentialsAck,
  SIGNAL_PAYLOAD_NULL,
  SIGNAL_PAYLOAD_TOO_LARGE,
} from './protocol-validators';

const VALID_UUID = '11111111-2222-4333-8444-555555555555';

describe('protocol-validators', () => {
  describe('parseHandshakeAuth', () => {
    it('accepts a valid Google handshake', () => {
      const result = parseHandshakeAuth({
        roomId: VALID_UUID,
        provider: 'google',
        token: 'jwt-token',
      });
      expect(result).toEqual({ roomId: VALID_UUID, provider: 'google', token: 'jwt-token' });
    });

    it('accepts a valid Yandex handshake', () => {
      const result = parseHandshakeAuth({
        roomId: VALID_UUID,
        provider: 'yandex',
        token: 'jwt-token',
      });
      expect(result.provider).toBe('yandex');
    });

    it('rejects invalid roomId', () => {
      expect(() =>
        parseHandshakeAuth({ roomId: 'not-a-uuid', provider: 'google', token: 'x' })
      ).toThrow(InvalidPayloadError);
    });

    it('rejects unknown provider', () => {
      expect(() =>
        parseHandshakeAuth({ roomId: VALID_UUID, provider: 'apple', token: 'x' })
      ).toThrow(InvalidPayloadError);
    });
  });

  describe('parseInitiatePayload', () => {
    it('accepts a valid payload', () => {
      const result = parseInitiatePayload({
        command: 'start',
        payload: { x: 1 },
        correlationId: 'corr-1',
      });
      expect(result.command).toBe('start');
    });

    it('rejects missing command', () => {
      expect(() =>
        parseInitiatePayload({ command: '', payload: null, correlationId: 'corr-1' })
      ).toThrow(InvalidPayloadError);
    });
  });

  describe('parseInitiateAck', () => {
    it('accepts a valid ack', () => {
      const result = parseInitiateAck({
        socketCount: 2,
        users: [{ userId: 'u1', displayName: 'A' }],
        correlationId: 'corr-1',
      });
      expect(result.socketCount).toBe(2);
    });

    it('rejects negative socketCount', () => {
      expect(() => parseInitiateAck({ socketCount: -1, users: [], correlationId: 'c' })).toThrow(
        InvalidPayloadError
      );
    });
  });

  describe('parseExecuteEvent', () => {
    it('accepts a valid event', () => {
      const result = parseExecuteEvent({
        command: 'do',
        payload: 1,
        correlationId: 'c',
        initiator: { userId: 'u', displayName: 'D', socketId: 's' },
      });
      expect(result.initiator.socketId).toBe('s');
    });

    it('rejects missing initiator', () => {
      expect(() => parseExecuteEvent({ command: 'do', payload: 1, correlationId: 'c' })).toThrow(
        InvalidPayloadError
      );
    });
  });

  describe('parseExecuteAck', () => {
    it('accepts a valid ack', () => {
      expect(parseExecuteAck({ payload: 'ok', correlationId: 'c' })).toEqual({
        payload: 'ok',
        correlationId: 'c',
      });
    });

    it('rejects missing correlationId', () => {
      expect(() => parseExecuteAck({ payload: 'ok' })).toThrow(InvalidPayloadError);
    });
  });

  describe('parseResponseEvent', () => {
    it('accepts kind=success with payload', () => {
      const event = parseResponseEvent({
        kind: 'success',
        correlationId: 'c',
        payload: { ok: true },
      });
      expect(event.kind).toBe('success');
    });

    it('accepts kind=dispatch-rejected with reason', () => {
      const event = parseResponseEvent({
        kind: 'dispatch-rejected',
        correlationId: 'c',
        reason: 'too-many-in-flight',
      });
      expect(event.kind).toBe('dispatch-rejected');
    });

    it('rejects unknown kind', () => {
      expect(() => parseResponseEvent({ kind: 'made-up', correlationId: 'c' })).toThrow(
        InvalidPayloadError
      );
    });
  });

  describe('parseRoomPresenceEvent', () => {
    it('accepts a valid event', () => {
      expect(parseRoomPresenceEvent({ socketCount: 0, users: [] }).socketCount).toBe(0);
    });
    it('rejects non-array users', () => {
      expect(() => parseRoomPresenceEvent({ socketCount: 0, users: 'nope' })).toThrow(
        InvalidPayloadError
      );
    });
  });

  describe('parseTokenExpiringEvent', () => {
    it('accepts a valid event', () => {
      expect(
        parseTokenExpiringEvent({
          expiresAt: '2030-01-01T00:00:00Z',
          secondsRemaining: 60,
        }).secondsRemaining
      ).toBe(60);
    });
    it('rejects negative secondsRemaining', () => {
      expect(() => parseTokenExpiringEvent({ expiresAt: 'x', secondsRemaining: -1 })).toThrow(
        InvalidPayloadError
      );
    });
  });

  describe('parseRefreshTokenPayload', () => {
    it('accepts a valid payload', () => {
      expect(parseRefreshTokenPayload({ token: 'jwt' }).token).toBe('jwt');
    });
    it('rejects empty token', () => {
      expect(() => parseRefreshTokenPayload({ token: '' })).toThrow(InvalidPayloadError);
    });
  });

  describe('parseRefreshTokenAck', () => {
    it('accepts ok=true', () => {
      expect(parseRefreshTokenAck({ ok: true, expiresAt: 'x' }).ok).toBe(true);
    });
    it('accepts ok=false with valid error code', () => {
      const ack = parseRefreshTokenAck({ ok: false, error: 'auth/invalid-token' });
      expect(ack.ok).toBe(false);
    });
    it('rejects unknown error code', () => {
      expect(() => parseRefreshTokenAck({ ok: false, error: 'auth/unknown' })).toThrow(
        InvalidPayloadError
      );
    });
  });

  describe('parseSignalPublishPayload', () => {
    it('accepts a valid payload', () => {
      const result = parseSignalPublishPayload({
        payload: { sdp: 'offer' },
        correlationId: 'c',
      });
      expect(result.correlationId).toBe('c');
    });

    it('rejects null payload with the null marker', () => {
      try {
        parseSignalPublishPayload({ payload: null });
        expect.fail('expected throw');
      } catch (caught) {
        expect(caught).toBeInstanceOf(InvalidPayloadError);
        expect((caught as InvalidPayloadError).message).toBe(SIGNAL_PAYLOAD_NULL);
      }
    });

    it('rejects undefined payload with the null marker', () => {
      try {
        parseSignalPublishPayload({ payload: undefined });
        expect.fail('expected throw');
      } catch (caught) {
        expect(caught).toBeInstanceOf(InvalidPayloadError);
        expect((caught as InvalidPayloadError).message).toBe(SIGNAL_PAYLOAD_NULL);
      }
    });

    it('rejects oversized payload with the too-large marker', () => {
      const big = 'x'.repeat(MAX_SIGNAL_PAYLOAD_BYTES + 100);
      try {
        parseSignalPublishPayload({ payload: { big } });
        expect.fail('expected throw');
      } catch (caught) {
        expect(caught).toBeInstanceOf(InvalidPayloadError);
        expect((caught as InvalidPayloadError).message).toBe(SIGNAL_PAYLOAD_TOO_LARGE);
      }
    });
  });

  describe('parseSignalEventOutbound', () => {
    it('accepts a valid event', () => {
      const event = parseSignalEventOutbound({
        payload: { sdp: 'a' },
        from: { userId: 'u', displayName: 'D', socketId: 's' },
      });
      expect(event.from.socketId).toBe('s');
    });
    it('rejects missing from', () => {
      expect(() => parseSignalEventOutbound({ payload: 1 })).toThrow(InvalidPayloadError);
    });
  });

  describe('parseSignalAck', () => {
    it('accepts ok=true', () => {
      expect(parseSignalAck({ ok: true, recipientCount: 3 }).ok).toBe(true);
    });
    it('rejects unknown error', () => {
      expect(() => parseSignalAck({ ok: false, error: 'no-such' })).toThrow(InvalidPayloadError);
    });
  });

  describe('parseTurnCredentialsAck', () => {
    it('accepts a valid ack', () => {
      const ack = parseTurnCredentialsAck({
        username: 'u',
        credential: 'c',
        ttl: 60,
        urls: ['turn:example:443'],
      });
      expect(ack.ttl).toBe(60);
    });
    it('rejects ttl=0', () => {
      expect(() =>
        parseTurnCredentialsAck({ username: 'u', credential: 'c', ttl: 0, urls: [] })
      ).toThrow(InvalidPayloadError);
    });
  });

  describe('parseServerDrainingEvent', () => {
    it('accepts an empty object', () => {
      expect(parseServerDrainingEvent({})).toEqual({});
    });
    it('rejects extra keys', () => {
      expect(() => parseServerDrainingEvent({ unexpected: 1 })).toThrow(InvalidPayloadError);
    });
  });
});
