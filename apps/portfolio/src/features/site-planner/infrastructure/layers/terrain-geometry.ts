import type { Vector2 } from '@frozik/utils/math/vector2';

import { densifyRing } from '../../domain/geometry/densify-ring';
import type { MultiPolygon, Ring } from '../../domain/geometry/polygon-types';
import type { Heightfield } from '../../domain/terrain/heightfield';
import { sampleHeight } from '../../domain/terrain/heightfield';
import type { Meters } from '../../domain/units';
import { planToWorld } from '../../domain/view/world-frame';

/** The ground as triangles: the index buffer of the sample grid and the boundary outline draped over it. */
export const FLOAT32_BYTES = 4;

export const WORLD_FLOATS_PER_VERTEX = 3;

export const OUTLINE_VERTEX_STRIDE = WORLD_FLOATS_PER_VERTEX * FLOAT32_BYTES;

/** Two triangles per grid cell. */
const INDICES_PER_CELL = 6;

/** Below two points there is no ring to walk. */
const MIN_RING_VERTEX_COUNT = 2;

/**
 * How far the boundary line floats over the ground it is draped on. Large
 * enough to clear the depth precision of a scene tens of metres across, small
 * enough to read as lying on the surface rather than hovering over it.
 */
const OUTLINE_ELEVATION_OFFSET: Meters = 0.03;

/**
 * Triangle indices of a `resolution × resolution` grid of samples, two per cell.
 * Row-major, matching the elevations: sample (column, row) is
 * `row * resolution + column`, which is also what the vertex shader reverses.
 */
export function buildGridIndices(resolution: number): Uint32Array {
  const cellsPerSide = resolution - 1;
  const indices = new Uint32Array(cellsPerSide * cellsPerSide * INDICES_PER_CELL);

  let offset = 0;

  for (let row = 0; row < cellsPerSide; row += 1) {
    for (let column = 0; column < cellsPerSide; column += 1) {
      const southWest = row * resolution + column;
      const southEast = southWest + 1;
      const northWest = southWest + resolution;
      const northEast = northWest + 1;

      indices[offset] = southWest;
      indices[offset + 1] = southEast;
      indices[offset + 2] = northEast;
      indices[offset + 3] = southWest;
      indices[offset + 4] = northEast;
      indices[offset + 5] = northWest;
      offset += INDICES_PER_CELL;
    }
  }

  return indices;
}

/**
 * The boundary as world-space line segments lying on the terrain. Every ring is
 * first split down to the cell size: a straight edge lifted only at its two ends
 * would cut through every rise between them.
 */
export function buildOutlinePositions(field: Heightfield, polygons: MultiPolygon): Float32Array {
  const positions: number[] = [];

  for (const polygon of polygons) {
    appendRingOutline(positions, field, polygon.outer);

    for (const hole of polygon.holes) {
      appendRingOutline(positions, field, hole);
    }
  }

  return Float32Array.from(positions);
}

function appendRingOutline(positions: number[], field: Heightfield, ring: Ring): void {
  const draped = densifyRing(ring, field.cellSizeMeters);

  if (draped.length < MIN_RING_VERTEX_COUNT) {
    return;
  }

  for (let index = 0; index < draped.length; index += 1) {
    appendOutlinePoint(positions, field, draped[index]);
    appendOutlinePoint(positions, field, draped[(index + 1) % draped.length]);
  }
}

function appendOutlinePoint(positions: number[], field: Heightfield, point: Vector2): void {
  const elevation = sampleHeight(field, point.x, point.y) + OUTLINE_ELEVATION_OFFSET;
  const [x, y, z] = planToWorld(point, elevation);

  positions.push(x, y, z);
}
