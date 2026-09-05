import type { Vector2 } from '@frozik/utils/math/vector2';
import type { Opaque } from '@frozik/utils/types/base';

import type { Meters } from '../units';

export type StairId = Opaque<'StairId', string>;

export function createStairId(): StairId {
  return crypto.randomUUID() as StairId;
}

/**
 * The market's baseline stair shapes (plan §6.1): one straight flight, a
 * quarter-turn and a half-turn — each with a landing — and the spiral.
 */
export type StairKind = 'straight' | 'l-shaped' | 'u-shaped' | 'spiral';

export const STAIR_KINDS: readonly StairKind[] = ['straight', 'l-shaped', 'u-shaped', 'spiral'];

/** What the stair flyout starts armed with — the commonest stair in a house. */
export const DEFAULT_STAIR_KIND: StairKind = 'straight';

/**
 * One stair on a storey, climbing toward the storey above. Only the intent is
 * stored — kind, place, turn and width; the run geometry (step count, riser,
 * tread, flight lengths, the footprint) DERIVES from the owning storey's
 * height (`building-editor.md` §5, plan §6.1 / O-A1: the Chief Architect
 * model — the stair stretches itself to reach the next floor).
 *
 * Positioning mirrors furniture: `position` is the footprint's bbox centre,
 * rotation counter-clockwise off plan east, the climb runs along local +y.
 */
export interface StairInstance {
  readonly id: StairId;
  readonly kind: StairKind;
  readonly position: Vector2;
  readonly rotationDegrees: number;
  /** Flight width; for the spiral this is the overall diameter. */
  readonly widthMeters: Meters;
  /**
   * Mirrored across its own climb axis. A quarter-turn stair comes in two
   * hands, and which one fits a hall is decided by the room, not the catalogue
   * — so the mirror is a property of the instance, like its turn.
   */
  readonly isMirrored?: boolean;
}

/** Catalog defaults per the norms (plan §6.1 / I3-2): comfort width, spiral ⌀. */
const DEFAULT_STAIR_WIDTH_METERS: Meters = 1.0;
const DEFAULT_SPIRAL_DIAMETER_METERS: Meters = 1.6;

function defaultStairWidth(kind: StairKind): Meters {
  return kind === 'spiral' ? DEFAULT_SPIRAL_DIAMETER_METERS : DEFAULT_STAIR_WIDTH_METERS;
}

export function createStair({
  kind,
  position,
  rotationDegrees = 0,
  widthMeters,
  isMirrored = false,
}: {
  readonly kind: StairKind;
  readonly position: Vector2;
  readonly rotationDegrees?: number;
  readonly widthMeters?: Meters;
  readonly isMirrored?: boolean;
}): StairInstance {
  return {
    id: createStairId(),
    kind,
    position,
    rotationDegrees,
    widthMeters: widthMeters ?? defaultStairWidth(kind),
    isMirrored,
  };
}
