import type { ISO, Opaque } from '@frozik/utils';

/**
 * Stable identifier of a conf room; used both in the URL and as the
 * y-webrtc topic suffix. Session-independent — two participants sharing
 * the same link join the same room.
 */
export type RoomId = Opaque<'ConfRoomId', string>;

/**
 * Per-session participant identifier. Minted with `crypto.randomUUID()`
 * on each room mount and held in memory only — conf is fully anonymous
 * and nothing about a participant is persisted.
 */
export type ParticipantId = Opaque<'ConfParticipantId', string>;

/**
 * Persisted lobby entry for a previously created or visited conf room.
 * Schema is intentionally minimal — conf rooms carry no name or template,
 * but the lobby still shows a "created by me / peer" badge derived from
 * `ownerParticipantId`. The field is `null` for rooms joined by link
 * (we don't carry owner info across the signaling boundary) and for
 * legacy rows written before this field was introduced.
 */
export interface IConfRoomIndexEntry {
  readonly roomId: RoomId;
  readonly createdAt: ISO;
  readonly lastVisitedAt: ISO;
  readonly ownerParticipantId: ParticipantId | null;
}

/**
 * A 2D point expressed in normalized image coordinates (each axis in
 * `[0, 1]` over the input image). Produced by MediaPipe's
 * `FaceLandmarker` and consumed by pure domain math.
 */
export interface INormalizedPoint {
  readonly x: number;
  readonly y: number;
}
