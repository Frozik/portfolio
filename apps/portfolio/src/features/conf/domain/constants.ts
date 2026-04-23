import type { Milliseconds } from '@frozik/utils';

/**
 * Hard cap on the number of simultaneous participants in a conf room.
 * Enforced client-side: once two peers are in a room any additional
 * `hello` is answered with a `bye{full}` payload.
 */
export const MAX_PARTICIPANTS = 2;

/**
 * Indices into the 478-landmark output of MediaPipe's `FaceLandmarker`.
 * These four points are the stable eye corners used to anchor the
 * glasses overlay — picked by MediaPipe's canonical Face Mesh topology.
 */
export const LANDMARK_INDEX_LEFT_EYE_OUTER = 33;
export const LANDMARK_INDEX_LEFT_EYE_INNER = 133;
export const LANDMARK_INDEX_RIGHT_EYE_INNER = 362;
export const LANDMARK_INDEX_RIGHT_EYE_OUTER = 263;

/**
 * Minimum landmark-array length required before we can read the four
 * eye-corner points listed above. One past the largest index used —
 * the inner right-eye corner (362) is the largest of the four.
 */
export const MIN_LANDMARKS_FOR_GLASSES = LANDMARK_INDEX_RIGHT_EYE_INNER + 1;

/**
 * Intrinsic width of the bundled glasses SVG artwork at `scale = 1`.
 * Must match the `viewBox` width of `presentation/assets/glasses.svg`
 * so the runtime transform's scale factor lands at `1.0` when the
 * inter-pupillary distance equals this value in CSS pixels.
 */
export const GLASSES_BASE_WIDTH_PX = 240;

/** Target detection cadence. 30 Hz is a comfortable budget for a dual GPU-backed FaceLandmarker. */
export const DETECT_MIN_INTERVAL_MS = 33 as Milliseconds;

/** Signaling WebSocket reconnect backoff bounds. */
export const SIGNALING_RECONNECT_MIN_MS = 500 as Milliseconds;
export const SIGNALING_RECONNECT_MAX_MS = 8_000 as Milliseconds;

/** Application-level ping cadence, matches retro-signaling's server timeout minus a safety margin. */
export const SIGNALING_HEARTBEAT_MS = 25_000 as Milliseconds;

/**
 * Rolling window of round-trip-time samples retained by the adaptive
 * quality layer for the sparkline in the room control bar. At a poll
 * cadence of 2.5 s, 30 samples ≈ 75 s of history — enough to see
 * short-term trends without overwhelming the control bar.
 */
export const RTT_HISTORY_MAX_SAMPLES = 30;
