import type { Vector2 } from '@frozik/utils/math/vector2';

import type { Meters } from '../units';
import type { Ring } from './polygon-types';

/** A ring needs two points before an edge can be split at all. */
const MIN_RING_VERTEX_COUNT = 2;

/**
 * Splits every edge of the ring until no segment is longer than
 * `maxSegmentMeters`, keeping the original vertices and the ring's closure.
 *
 * A polyline draped over sampled terrain has to break at least as often as the
 * grid it follows: a long straight edge lifted only at its endpoints cuts
 * through every hill in between.
 */
export function densifyRing(ring: Ring, maxSegmentMeters: Meters): readonly Vector2[] {
  if (ring.length < MIN_RING_VERTEX_COUNT || !(maxSegmentMeters > 0)) {
    return ring;
  }

  const points: Vector2[] = [];

  for (let index = 0; index < ring.length; index += 1) {
    const start = ring[index];
    const end = ring[(index + 1) % ring.length];
    const stepCount = Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / maxSegmentMeters);

    points.push(start);

    for (let step = 1; step < stepCount; step += 1) {
      const ratio = step / stepCount;

      points.push({
        x: start.x + (end.x - start.x) * ratio,
        y: start.y + (end.y - start.y) * ratio,
      });
    }
  }

  return points;
}
