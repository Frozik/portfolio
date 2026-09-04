import { isNil } from 'lodash-es';
import type { ParticipantId } from './types';

/**
 * Application-level signaling payloads exchanged between conf peers on
 * top of the shared signaling server's generic y-webrtc-style pub/sub.
 *
 * The transport is broadcast inside a single topic per room
 * (`frozik-conf-<roomId>`) — every member of the topic receives every
 * message. Recipients filter out their own echoes via `from === self`.
 *
 * `bye { full }` MUST carry a `to` addressed at the rejected newcomer:
 * without it, when a 3rd participant joins, BOTH existing peers broadcast
 * `bye { full }` and each receives the OTHER's copy, wrongly flipping
 * itself into `room-full` and killing a healthy call. `bye { leave }` is
 * an un-addressed broadcast — it concerns the whole topic.
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
      /** Target participant — set for `full` (addressed rejection), omitted for `leave`. */
      readonly to?: ParticipantId;
    };

/** Possible values of the `type` discriminator, extracted for validation loops. */
const SIGNAL_MESSAGE_TYPES = ['hello', 'offer', 'answer', 'ice', 'bye'] as const;
type TConfSignalMessageType = (typeof SIGNAL_MESSAGE_TYPES)[number];

const BYE_REASONS = ['full', 'leave'] as const;
type TByeReason = (typeof BYE_REASONS)[number];

function isRecord(value: unknown): value is Record<string, unknown> {
  return !isNil(value) && typeof value === 'object' && !Array.isArray(value);
}

function isSignalMessageType(value: unknown): value is TConfSignalMessageType {
  return (
    typeof value === 'string' && SIGNAL_MESSAGE_TYPES.includes(value as TConfSignalMessageType)
  );
}

function isByeReason(value: unknown): value is TByeReason {
  return typeof value === 'string' && BYE_REASONS.includes(value as TByeReason);
}

function asParticipantId(value: unknown): ParticipantId | undefined {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }
  return value as ParticipantId;
}

function asCandidate(value: unknown): RTCIceCandidateInit | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const { candidate, sdpMid, sdpMLineIndex, usernameFragment } = value;
  const init: RTCIceCandidateInit = {};

  if (typeof candidate === 'string') {
    init.candidate = candidate;
  } else if (!isNil(candidate)) {
    return undefined;
  }
  if (typeof sdpMid === 'string') {
    init.sdpMid = sdpMid;
  } else if (!isNil(sdpMid)) {
    return undefined;
  }
  if (typeof sdpMLineIndex === 'number') {
    init.sdpMLineIndex = sdpMLineIndex;
  } else if (!isNil(sdpMLineIndex)) {
    return undefined;
  }
  if (typeof usernameFragment === 'string') {
    init.usernameFragment = usernameFragment;
  } else if (!isNil(usernameFragment)) {
    return undefined;
  }
  return init;
}

/**
 * Validate and narrow an incoming signaling payload. Returns `undefined` for
 * anything that does not match the wire schema — callers should drop
 * undefined results silently so a buggy or malicious peer cannot crash the
 * room.
 */
export function parseConfSignalMessage(value: unknown): TConfSignalMessage | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const { type, from } = value;
  if (!isSignalMessageType(type)) {
    return undefined;
  }

  const participantId = asParticipantId(from);
  if (participantId === undefined) {
    return undefined;
  }

  switch (type) {
    case 'hello': {
      const { session } = value;
      if (typeof session !== 'string' || session.length === 0) {
        return undefined;
      }
      return { type, from: participantId, session };
    }
    case 'offer':
    case 'answer': {
      const { sdp } = value;
      if (typeof sdp !== 'string' || sdp.length === 0) {
        return undefined;
      }
      return { type, from: participantId, sdp };
    }
    case 'ice': {
      const candidate = asCandidate(value.candidate);
      if (candidate === undefined) {
        return undefined;
      }
      return { type, from: participantId, candidate };
    }
    case 'bye': {
      const { reason, to } = value;
      const target = asParticipantId(to);
      if (isNil(reason)) {
        return target === undefined
          ? { type, from: participantId }
          : { type, from: participantId, to: target };
      }
      if (!isByeReason(reason)) {
        return undefined;
      }
      return target === undefined
        ? { type, from: participantId, reason }
        : { type, from: participantId, reason, to: target };
    }
  }
}
