import type { Vector2 } from '@frozik/utils/math/vector2';

import type { Meters } from '../units';
import type { Shape } from './shapes';
import { createRectangle } from './shapes';

/**
 * A slab of a storey's floor. It is a plain {@link Shape} — the very rectangle,
 * circle or ellipse the plot itself is drawn with — so the floor of an upper
 * storey is drawn, sized and turned by the primitives already learned downstairs
 * rather than by a second, poorer set of its own.
 *
 * A storey's outline is the union of its slabs. Walls describe the rooms; the
 * slabs describe the FLOOR — which is why a balcony, a canopy deck or a room
 * hanging past the storey below needs one and needs no walls at all. Keeping
 * the outline in slabs rather than deriving it from a closed wall ring also
 * gives wall drawing something to be held to: a wall belongs to the floor it
 * stands on, and cannot wander off it.
 */
export type Slab = Shape;

export const DEFAULT_SLAB_WIDTH_METERS: Meters = 6;
export const DEFAULT_SLAB_LENGTH_METERS: Meters = 4;

/** The plate a plain click lays down, before it is dragged or typed to size. */
export function createSlab(center: Vector2): Slab {
  return createRectangle({
    center,
    width: DEFAULT_SLAB_WIDTH_METERS,
    length: DEFAULT_SLAB_LENGTH_METERS,
    rotationDegrees: 0,
  });
}

/** The shared empty list, so an absent floor reads as one stable value. */
export const NO_SLABS: readonly Slab[] = [];
