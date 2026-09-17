import type { Vector2 } from '@frozik/utils/math/vector2';

import type { BallState } from '../domain/ball';

/** How many physics steps of the flight the trail remembers: a ninth of a second of game time — about 0.7 m at a brisk 6 m/s (eight was too short to notice, twenty too much). */
const TRAIL_STEPS = 14;

/**
 * The trail after one more step: the flying ball's last positions, oldest
 * first, so it bends where the flight bent. A ball that is not flying
 * leaves none.
 */
export function extendTrail(trail: readonly Vector2[], ball: BallState): readonly Vector2[] {
  return ball.phase === 'flying' ? [...trail, ball.position].slice(-TRAIL_STEPS) : [];
}
