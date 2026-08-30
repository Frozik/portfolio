import type { Vector2 } from '@frozik/utils/math/vector2';

import type { Meters } from '../units';

/** A position in world space as `[x, y, z]` — see {@link planToWorld} for the axes. */
export type WorldPoint = readonly [number, number, number];

/**
 * The single crossing from the plan's frame to the renderer's.
 *
 * The plan is drawn north-up in two dimensions (`x` east, `y` north); the world
 * the scene is rendered in is right-handed with `+X` east, `+Y` up and `+Z`
 * south — so plan north becomes `−Z`. Every place that could get the direction
 * of north wrong — the camera, the ground mesh, the sun — goes through this one
 * function, because a scene lit from the wrong side is a bug nobody sees until
 * the shadows fall the wrong way.
 */
export function planToWorld(point: Vector2, elevation: Meters): WorldPoint {
  return [point.x, elevation, -point.y];
}
