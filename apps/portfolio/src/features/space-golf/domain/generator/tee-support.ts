import type { Vector2 } from '@frozik/utils/math/vector2';

import { BALL_RADIUS_METERS } from '../constants';
import type { Edge } from '../level';
import { dot, subtract } from '../vector';

/** The tee's floor is the face right under the ball. */
const TEE_SUPPORT_METERS = 2 * BALL_RADIUS_METERS;

/** Whether the face is the one the ball starts on. */
export function supportsTee(face: Edge, tee: Vector2): boolean {
  const offset = subtract(tee, face.from);
  const above = dot(offset, face.normal);
  const along = dot(offset, face.direction);
  return above >= 0 && above <= TEE_SUPPORT_METERS && along >= 0 && along <= face.length;
}
