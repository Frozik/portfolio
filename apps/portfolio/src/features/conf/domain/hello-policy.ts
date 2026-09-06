import { isNil } from 'lodash-es';

import type { ParticipantId } from './types';

/** What the room knows about the peer in its one seat. */
export interface SeatedPeer {
  readonly remoteId: ParticipantId;
  readonly remoteSessionId: string | undefined;
  readonly isLive: boolean;
}

/**
 * What a `hello` means while the seat is taken: a third participant is
 * rejected, an echo of the seated peer's own hello is ignored, a session id
 * arriving late for a peer accepted from an early offer is recorded, and the
 * same participant back after a drop replaces the dead session.
 */
export type HelloDecision =
  | { readonly kind: 'reject' }
  | { readonly kind: 'ignore' }
  | { readonly kind: 'record-session' }
  | { readonly kind: 'replace' };

export function decideOnHello(
  seated: SeatedPeer | undefined,
  from: ParticipantId,
  session: string
): HelloDecision {
  if (isNil(seated) || !seated.isLive) {
    return { kind: 'replace' };
  }
  if (seated.remoteId !== from) {
    return { kind: 'reject' };
  }
  if (seated.remoteSessionId === session) {
    return { kind: 'ignore' };
  }
  return isNil(seated.remoteSessionId) ? { kind: 'record-session' } : { kind: 'replace' };
}
