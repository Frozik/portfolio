import type { Vector2 } from '@frozik/utils/math/vector2';

import { normalizeTurnDegrees, RADIANS_TO_DEGREES } from '../units';

/**
 * The one statement of what `northOffsetDegrees` means, which everything that
 * reads it agrees with: the plan's corner compass (`plan-draw/draw-compass.ts`),
 * the dial of the compass panel, the gizmo over the 3D view
 * (`view/scene-compass.ts`) and the sun (`sun/sun-direction.ts`).
 *
 * A plot is drawn the way it is convenient to draw it — square to the sheet —
 * and the offset says how far the drawing's own north has been turned
 * **clockwise, eastwards** off the geographic one. So an offset of 90° means the
 * plan was drawn a quarter turn to the east of true north, which puts geographic
 * north on the plan's western side: the needle swings **anticlockwise** on any
 * view whose up is plan north, and the sun swings with it.
 *
 * Returns where the needle points, in degrees clockwise from the top of the
 * view — the frame both SVG compasses and the canvas one are built in.
 */
export function northNeedleAngleDegrees(northOffsetDegrees: number): number {
  return normalizeTurnDegrees(-northOffsetDegrees);
}

/**
 * The inverse, for a needle dragged by the pointer: the offset whose needle
 * would point from the centre of a dial along `screenOffset`. Screen `y` grows
 * downwards, so straight up is `(0, −1)` and the turn runs clockwise from it.
 */
export function northOffsetTowards({ x, y }: Vector2): number {
  return normalizeTurnDegrees(-Math.atan2(x, -y) * RADIANS_TO_DEGREES);
}
