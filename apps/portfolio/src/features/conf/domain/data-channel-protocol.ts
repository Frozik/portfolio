import type { TEmotion } from './emotion';

/**
 * Low-traffic payloads exchanged between the two peers directly over a
 * negotiated `RTCDataChannel`, separate from the signaling WebSocket
 * used for SDP / ICE. Intended for ambient presence signals that do not
 * need a server to route them: the current `emotion` read off the
 * blendshape classifier, typing indicators, etc.
 *
 * Keeping the envelope as a discriminated union lets future message
 * kinds ride on the same channel without breaking the existing
 * validator — unknown `kind` values are rejected.
 */
export type TConfDataChannelMessage = { readonly kind: 'emotion'; readonly value: TEmotion };

const DATA_CHANNEL_MESSAGE_KINDS = ['emotion'] as const;
type TDataChannelMessageKind = (typeof DATA_CHANNEL_MESSAGE_KINDS)[number];

const EMOTION_VALUES = ['happy', 'surprised', 'sad', 'angry', 'neutral'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDataChannelKind(value: unknown): value is TDataChannelMessageKind {
  return (
    typeof value === 'string' &&
    DATA_CHANNEL_MESSAGE_KINDS.includes(value as TDataChannelMessageKind)
  );
}

function isEmotionValue(value: unknown): value is TEmotion {
  return typeof value === 'string' && EMOTION_VALUES.includes(value as TEmotion);
}

/**
 * Validate and narrow an incoming JSON-decoded data-channel payload.
 * Returns `null` on anything that does not match the wire schema —
 * callers should drop null results silently so a buggy or malicious
 * peer cannot crash the room.
 */
export function parseConfDataChannelMessage(value: unknown): TConfDataChannelMessage | null {
  if (!isRecord(value)) {
    return null;
  }
  if (!isDataChannelKind(value.kind)) {
    return null;
  }
  switch (value.kind) {
    case 'emotion': {
      if (!isEmotionValue(value.value)) {
        return null;
      }
      return { kind: 'emotion', value: value.value };
    }
  }
}
