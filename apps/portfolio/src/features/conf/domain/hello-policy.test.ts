import { describe, expect, it } from 'vitest';

import { decideOnHello } from './hello-policy';
import type { ParticipantId } from './types';

const ALICE = 'alice' as ParticipantId;
const BOB = 'bob' as ParticipantId;

describe('decideOnHello', () => {
  it('seats the first participant to say hello', () => {
    expect(decideOnHello(undefined, ALICE, 's1')).toEqual({ kind: 'replace' });
  });

  it('rejects a third participant while the seat is live', () => {
    expect(
      decideOnHello({ remoteId: ALICE, remoteSessionId: 's1', isLive: true }, BOB, 's2')
    ).toEqual({ kind: 'reject' });
  });

  it('ignores the seated peer repeating its own hello', () => {
    expect(
      decideOnHello({ remoteId: ALICE, remoteSessionId: 's1', isLive: true }, ALICE, 's1')
    ).toEqual({ kind: 'ignore' });
  });

  it('records the session of a peer that was seated from an early offer', () => {
    expect(
      decideOnHello({ remoteId: ALICE, remoteSessionId: undefined, isLive: true }, ALICE, 's1')
    ).toEqual({ kind: 'record-session' });
  });

  it('replaces the session when the same participant comes back after a drop', () => {
    expect(
      decideOnHello({ remoteId: ALICE, remoteSessionId: 's1', isLive: true }, ALICE, 's2')
    ).toEqual({ kind: 'replace' });
  });

  it('replaces a seat whose peer is no longer live, whoever says hello', () => {
    expect(
      decideOnHello({ remoteId: ALICE, remoteSessionId: 's1', isLive: false }, BOB, 's2')
    ).toEqual({ kind: 'replace' });
  });
});
