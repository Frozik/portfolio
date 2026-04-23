import { describe, expect, it } from 'vitest';
import { parseConfSignalMessage } from './signaling-protocol';
import type { ParticipantId } from './types';

const ALICE = 'alice' as ParticipantId;

describe('parseConfSignalMessage', () => {
  it('parses a well-formed hello message with session', () => {
    expect(parseConfSignalMessage({ type: 'hello', from: ALICE, session: 'sess-1' })).toEqual({
      type: 'hello',
      from: ALICE,
      session: 'sess-1',
    });
  });

  it('rejects hello missing the session field', () => {
    expect(parseConfSignalMessage({ type: 'hello', from: ALICE })).toBeNull();
    expect(parseConfSignalMessage({ type: 'hello', from: ALICE, session: '' })).toBeNull();
  });

  it('parses offer and answer messages with sdp', () => {
    const offer = parseConfSignalMessage({ type: 'offer', from: ALICE, sdp: 'v=0\r\n' });
    expect(offer).toEqual({ type: 'offer', from: ALICE, sdp: 'v=0\r\n' });

    const answer = parseConfSignalMessage({ type: 'answer', from: ALICE, sdp: 'v=0\r\n' });
    expect(answer).toEqual({ type: 'answer', from: ALICE, sdp: 'v=0\r\n' });
  });

  it('rejects offer or answer missing the sdp field', () => {
    expect(parseConfSignalMessage({ type: 'offer', from: ALICE })).toBeNull();
    expect(parseConfSignalMessage({ type: 'answer', from: ALICE, sdp: '' })).toBeNull();
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
    ).toBeNull();
    expect(
      parseConfSignalMessage({
        type: 'ice',
        from: ALICE,
        candidate: { sdpMLineIndex: 'zero' },
      })
    ).toBeNull();
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

  it('rejects bye with an unknown reason', () => {
    expect(parseConfSignalMessage({ type: 'bye', from: ALICE, reason: 'other' })).toBeNull();
  });

  it('rejects messages with missing or empty from', () => {
    expect(parseConfSignalMessage({ type: 'hello', from: '' })).toBeNull();
    expect(parseConfSignalMessage({ type: 'hello' })).toBeNull();
  });

  it('rejects messages with unknown type', () => {
    expect(parseConfSignalMessage({ type: 'ping', from: ALICE })).toBeNull();
  });

  it('rejects non-record inputs', () => {
    expect(parseConfSignalMessage(null)).toBeNull();
    expect(parseConfSignalMessage(undefined)).toBeNull();
    expect(parseConfSignalMessage('hello')).toBeNull();
    expect(parseConfSignalMessage(42)).toBeNull();
    expect(parseConfSignalMessage(['hello'])).toBeNull();
  });
});
