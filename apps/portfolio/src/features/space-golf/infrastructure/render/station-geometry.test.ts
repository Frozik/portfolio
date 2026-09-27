import type { Vector2 } from '@frozik/utils/math/vector2';
import { describe, expect, it } from 'vitest';

import { MESH_VERTEX_STRIDE_BYTES } from './mesh-writer';
import type { Station } from './station';
import { STATION_HALF_SPAN_METERS, STATION_REACH_METERS } from './station';
import { buildStationMesh } from './station-geometry';

const POSITION = { x: 3, y: 47 };
const ADRIFT = { position: POSITION, ageSeconds: 0, dayShare: 0, shadowWay: { x: 1, y: 0 } };
const FALLING: Station = { ...ADRIFT, attitude: { x: 0, y: -1 } };
const SIDEWAYS: Station = { ...ADRIFT, attitude: { x: -1, y: 0 } };

function pointsOf(station: Station | undefined): readonly Vector2[] {
  const { vertexData, vertexCount } = buildStationMesh(station);
  const view = new DataView(vertexData);
  const points: Vector2[] = [];
  for (let index = 0; index < vertexCount; index += 1) {
    const offset = index * MESH_VERTEX_STRIDE_BYTES;
    points.push({ x: view.getFloat32(offset, true), y: view.getFloat32(offset + 4, true) });
  }
  return points;
}

function spanOf(points: readonly Vector2[], axis: 'x' | 'y'): number {
  const along = points.map(point => point[axis]);
  return Math.max(...along) - Math.min(...along);
}

describe('the station as it is drawn', () => {
  it('draws nothing while none is abroad', () => {
    expect(pointsOf(undefined)).toHaveLength(0);
  });

  it('spans a quarter of what a middling galaxy does, its truss lying across the way it set out', () => {
    const falling = pointsOf(FALLING);

    expect(spanOf(falling, 'x')).toBeCloseTo(2 * STATION_HALF_SPAN_METERS, 3);
    expect(spanOf(falling, 'y')).toBeLessThan(spanOf(falling, 'x'));
  });

  it('lies the way it set out, whichever that was', () => {
    const [falling, sideways] = [pointsOf(FALLING), pointsOf(SIDEWAYS)];

    expect(spanOf(sideways, 'y')).toBeCloseTo(spanOf(falling, 'x'), 3);
    expect(spanOf(sideways, 'x')).toBeCloseTo(spanOf(falling, 'y'), 3);
  });

  it('keeps the whole of it within the reach it comes and goes by, so none of it is seen to appear', () => {
    for (const point of pointsOf({ ...ADRIFT, attitude: { x: 0.6, y: 0.8 } })) {
      expect(Math.hypot(point.x - POSITION.x, point.y - POSITION.y)).toBeLessThanOrEqual(
        STATION_REACH_METERS
      );
    }
  });

  it('carries its modules ahead of the truss a shorter way than behind it: it is told fore from aft', () => {
    const falling = pointsOf(FALLING).filter(point => Math.abs(point.x - POSITION.x) < 0.1);

    const fore = POSITION.y - Math.min(...falling.map(point => point.y));
    const aft = Math.max(...falling.map(point => point.y)) - POSITION.y;
    expect(aft).toBeGreaterThan(fore);
  });
});
