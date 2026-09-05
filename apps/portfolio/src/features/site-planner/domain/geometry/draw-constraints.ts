import type { Vector2 } from '@frozik/utils/math/vector2';
import type { Meters } from '../units';
import { DEGREES_TO_RADIANS } from '../units';

/**
 * The angular step Shift locks a drawn segment to — the CAD convention every
 * reference editor shares (AutoCAD ORTHO, SketchUp inference lock, Figma
 * Shift): 0/90 for square rooms, 45 for a corner cut, 15 for everything else.
 */
const ANGLE_LOCK_STEP_DEGREES = 15;

const FULL_TURN_DEGREES = 360;

/** What the readout by the cursor states about the segment being drawn. */
export interface SegmentReadout {
  readonly lengthMeters: Meters;
  /** Counter-clockwise from plan east, 0…360. */
  readonly angleDegrees: number;
}

export function segmentReadout(from: Vector2, to: Vector2): SegmentReadout {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const rawDegrees =
    (Math.atan2(dy, dx) / DEGREES_TO_RADIANS + FULL_TURN_DEGREES) % FULL_TURN_DEGREES;

  return { lengthMeters: Math.hypot(dx, dy), angleDegrees: rawDegrees };
}

/**
 * `to`, turned onto the nearest multiple of `stepDegrees` about `from` while
 * keeping its distance. This is what Shift does while a wall is being drawn:
 * the corner still follows the mouse, but the wall itself comes out straight.
 */
export function constrainToAngleStep(
  from: Vector2,
  to: Vector2,
  stepDegrees: number = ANGLE_LOCK_STEP_DEGREES
): Vector2 {
  const { lengthMeters, angleDegrees } = segmentReadout(from, to);

  if (lengthMeters === 0) {
    return to;
  }

  const lockedDegrees = Math.round(angleDegrees / stepDegrees) * stepDegrees;
  const lockedRadians = lockedDegrees * DEGREES_TO_RADIANS;

  return {
    x: from.x + Math.cos(lockedRadians) * lengthMeters,
    y: from.y + Math.sin(lockedRadians) * lengthMeters,
  };
}

/**
 * `to` pushed to the exact distance the user typed, along the direction the
 * cursor points — the VCB of SketchUp and the dynamic input of AutoCAD:
 * aim roughly, then state the number and let the geometry be exact.
 */
export function applyTypedLength(from: Vector2, to: Vector2, lengthMeters: Meters): Vector2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const currentLength = Math.hypot(dx, dy);

  if (currentLength === 0 || lengthMeters <= 0) {
    return to;
  }

  const scale = lengthMeters / currentLength;

  return { x: from.x + dx * scale, y: from.y + dy * scale };
}

/** Keys the value-control box accepts: digits and one decimal separator. */
export const TYPED_LENGTH_KEY_PATTERN = /^[0-9.,]$/;

/**
 * Accumulates a typed length. Kept as TEXT rather than a number so the half
 * finished states a person actually types — `4`, `4.`, `4.2` — survive, and
 * so a trailing separator does not read as a different number.
 */
export function appendTypedLengthKey(current: string | undefined, key: string): string {
  const normalized = key === ',' ? '.' : key;
  const next = `${current ?? ''}${normalized}`;

  // One separator only; a second is the user correcting themselves, ignored.
  return next.split('.').length > 2 ? (current ?? '') : next;
}

/** The metres a typed string stands for, or nothing while it is unusable. */
export function parseTypedLength(text: string | undefined): Meters | undefined {
  if (text === undefined || text === '' || text === '.') {
    return undefined;
  }

  const parsed = Number.parseFloat(text);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
