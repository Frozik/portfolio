import { describe, expect, it } from 'vitest';
import { parseConfSignalMessage } from './signaling-protocol';
import type { ParticipantId } from './types';

const ALICE = 'alice' as ParticipantId;
const BOB = 'bob' as ParticipantId;

describe('parseConfSignalMessage', () => {
  it('parses a well-formed hello message with session', () => {
    expect(parseConfSignalMessage({ type: 'hello', from: ALICE, session: 'sess-1' })).toEqual({
      type: 'hello',
      from: ALICE,
      session: 'sess-1',
    });
  });

  it('rejects hello missing the session field', () => {
    expect(parseConfSignalMessage({ type: 'hello', from: ALICE })).toBeUndefined();
    expect(parseConfSignalMessage({ type: 'hello', from: ALICE, session: '' })).toBeUndefined();
  });

  it('parses offer and answer messages with sdp', () => {
    const offer = parseConfSignalMessage({ type: 'offer', from: ALICE, sdp: 'v=0\r\n' });
    expect(offer).toEqual({ type: 'offer', from: ALICE, sdp: 'v=0\r\n' });

    const answer = parseConfSignalMessage({ type: 'answer', from: ALICE, sdp: 'v=0\r\n' });
    expect(answer).toEqual({ type: 'answer', from: ALICE, sdp: 'v=0\r\n' });
  });

  it('rejects offer or answer missing the sdp field', () => {
    expect(parseConfSignalMessage({ type: 'offer', from: ALICE })).toBeUndefined();
    expect(parseConfSignalMessage({ type: 'answer', from: ALICE, sdp: '' })).toBeUndefined();
  });

  it('parses ice messages with a full candidate init', () => {
    const payload = {
      type: 'ice',
      from: ALICE,
      candidate: {
        candidate: 'candidate:1 1 udp 2113937151 192.0.2.1 50000 typ host',
        sdpMid: '0',
        sdpMLineIndex: 0,
        usernameFragment: 'abcd',
      },
    };
    expect(parseConfSignalMessage(payload)).toEqual(payload);
  });

  it('parses ice messages with an empty candidate object (end-of-candidates marker)', () => {
    expect(parseConfSignalMessage({ type: 'ice', from: ALICE, candidate: {} })).toEqual({
      type: 'ice',
      from: ALICE,
      candidate: {},
    });
  });

  it('rejects ice messages whose candidate has wrong field types', () => {
    expect(
      parseConfSignalMessage({ type: 'ice', from: ALICE, candidate: { candidate: 42 } })
    ).toBeUndefined();
    expect(
      parseConfSignalMessage({
        type: 'ice',
        from: ALICE,
        candidate: { sdpMLineIndex: 'zero' },
      })
    ).toBeUndefined();
  });

  it('parses bye messages with and without a reason', () => {
    expect(parseConfSignalMessage({ type: 'bye', from: ALICE })).toEqual({
      type: 'bye',
      from: ALICE,
    });
    expect(parseConfSignalMessage({ type: 'bye', from: ALICE, reason: 'leave' })).toEqual({
      type: 'bye',
      from: ALICE,
      reason: 'leave',
    });
    expect(parseConfSignalMessage({ type: 'bye', from: ALICE, reason: 'full' })).toEqual({
      type: 'bye',
      from: ALICE,
      reason: 'full',
    });
  });

  it('parses bye{full} with an addressed target', () => {
    expect(parseConfSignalMessage({ type: 'bye', from: ALICE, reason: 'full', to: BOB })).toEqual({
      type: 'bye',
      from: ALICE,
      reason: 'full',
      to: BOB,
    });
  });

  it('drops an empty target instead of returning to: ""', () => {
    expect(parseConfSignalMessage({ type: 'bye', from: ALICE, reason: 'full', to: '' })).toEqual({
      type: 'bye',
      from: ALICE,
      reason: 'full',
    });
  });

  it('rejects bye with an unknown reason', () => {
    expect(parseConfSignalMessage({ type: 'bye', from: ALICE, reason: 'other' })).toBeUndefined();
  });

  it('rejects messages with missing or empty from', () => {
    expect(parseConfSignalMessage({ type: 'hello', from: '' })).toBeUndefined();
    expect(parseConfSignalMessage({ type: 'hello' })).toBeUndefined();
  });

  it('rejects messages with unknown type', () => {
    expect(parseConfSignalMessage({ type: 'ping', from: ALICE })).toBeUndefined();
  });

  it('rejects non-record inputs', () => {
    expect(parseConfSignalMessage(undefined)).toBeUndefined();
    expect(parseConfSignalMessage(undefined)).toBeUndefined();
    expect(parseConfSignalMessage('hello')).toBeUndefined();
    expect(parseConfSignalMessage(42)).toBeUndefined();
    expect(parseConfSignalMessage(['hello'])).toBeUndefined();
  });
});
