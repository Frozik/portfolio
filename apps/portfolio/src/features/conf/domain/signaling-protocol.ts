import { isNil } from 'lodash-es';
import type { ParticipantId } from './types';

/**
 * Application-level signaling payloads exchanged between conf peers on
 * top of the shared signaling server's generic y-webrtc-style pub/sub.
 *
 * The transport is broadcast inside a single topic per room
 * (`frozik-conf-<roomId>`) — every member of the topic receives every
 * message. Recipients filter out their own echoes via `from === self`;
 * for a 2-peer room this is enough to route correctly without an
 * explicit `to` field. When a 3rd joiner triggers a `bye { full }`,
 * both existing peers broadcast it and the newcomer receives at least
 * one copy.
 */
export type TConfSignalMessage =
  | { readonly type: 'hello'; readonly from: ParticipantId; readonly session: string }
  | { readonly type: 'offer'; readonly from: ParticipantId; readonly sdp: string }
  | { readonly type: 'answer'; readonly from: ParticipantId; readonly sdp: string }
  | {
      readonly type: 'ice';
      readonly from: ParticipantId;
      readonly candidate: RTCIceCandidateInit;
    }
  | {
      readonly type: 'bye';
      readonly from: ParticipantId;
      readonly reason?: 'full' | 'leave';
    };

/** Possible values of the `type` discriminator, extracted for validation loops. */
const SIGNAL_MESSAGE_TYPES = ['hello', 'offer', 'answer', 'ice', 'bye'] as const;
type TConfSignalMessageType = (typeof SIGNAL_MESSAGE_TYPES)[number];

const BYE_REASONS = ['full', 'leave'] as const;
type TByeReason = (typeof BYE_REASONS)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSignalMessageType(value: unknown): value is TConfSignalMessageType {
  return (
    typeof value === 'string' && SIGNAL_MESSAGE_TYPES.includes(value as TConfSignalMessageType)
  );
}

function isByeReason(value: unknown): value is TByeReason {
  return typeof value === 'string' && BYE_REASONS.includes(value as TByeReason);
}

function asParticipantId(value: unknown): ParticipantId | null {
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }
  return value as ParticipantId;
}

function asCandidate(value: unknown): RTCIceCandidateInit | null {
  if (!isRecord(value)) {
    return null;
  }
  const { candidate, sdpMid, sdpMLineIndex, usernameFragment } = value;
  const init: RTCIceCandidateInit = {};

  if (typeof candidate === 'string') {
    init.candidate = candidate;
  } else if (!isNil(candidate)) {
    return null;
  }

  if (typeof sdpMid === 'string' || sdpMid === null) {
    init.sdpMid = sdpMid;
  } else if (!isNil(sdpMid)) {
    return null;
  }

  if (typeof sdpMLineIndex === 'number' || sdpMLineIndex === null) {
    init.sdpMLineIndex = sdpMLineIndex;
  } else if (!isNil(sdpMLineIndex)) {
    return null;
  }

  if (typeof usernameFragment === 'string' || usernameFragment === null) {
    init.usernameFragment = usernameFragment;
  } else if (!isNil(usernameFragment)) {
    return null;
  }

  return init;
}

/**
 * Validate and narrow an incoming signaling payload. Returns `null` for
 * anything that does not match the wire schema — callers should drop
 * null results silently so a buggy or malicious peer cannot crash the
 * room.
 */
export function parseConfSignalMessage(value: unknown): TConfSignalMessage | null {
  if (!isRecord(value)) {
    return null;
  }

  const { type, from } = value;
  if (!isSignalMessageType(type)) {
    return null;
  }

  const participantId = asParticipantId(from);
  if (participantId === null) {
    return null;
  }

  switch (type) {
    case 'hello': {
      const { session } = value;
      if (typeof session !== 'string' || session.length === 0) {
        return null;
      }
      return { type, from: participantId, session };
    }
    case 'offer':
    case 'answer': {
      const { sdp } = value;
      if (typeof sdp !== 'string' || sdp.length === 0) {
        return null;
      }
      return { type, from: participantId, sdp };
    }
    case 'ice': {
      const candidate = asCandidate(value.candidate);
      if (candidate === null) {
        return null;
      }
      return { type, from: participantId, candidate };
    }
    case 'bye': {
      const { reason } = value;
      if (isNil(reason)) {
        return { type, from: participantId };
      }
      if (!isByeReason(reason)) {
        return null;
      }
      return { type, from: participantId, reason };
    }
  }
}
