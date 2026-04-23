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
 * Schema is intentionally minimal — conf rooms carry no name, template
 * or identity, unlike retro's richer room index.
 */
export interface IConfRoomIndexEntry {
  readonly roomId: RoomId;
  readonly createdAt: ISO;
  readonly lastVisitedAt: ISO;
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
