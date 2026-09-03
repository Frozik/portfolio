import type { Vector2 } from '@frozik/utils/math/vector2';
import { isEqual } from 'lodash-es';

/** A clicked-out polyline with immediate repeats collapsed — a double click adds no segment. */
export function dropRepeatedPoints(points: readonly Vector2[]): readonly Vector2[] {
  return points.filter((point, index) => index === 0 || !isEqual(point, points[index - 1]));
}
