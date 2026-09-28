import type { MultiPolygon } from '@frozik/utils/geometry/polygonTypes';
import { triangulateMultiPolygon } from '@frozik/utils/geometry/triangulatePolygon';

import { STREET_MESH_UNIT_M } from './constants';

/**
 * The water of a tile as one flat mesh on the ground: every vertex two
 * `int16` (x east, z south) in `STREET_MESH_UNIT_M` from the tile's
 * north-west corner, like the building boxes.
 */
export interface WaterMesh {
  readonly positions: Int16Array;
  readonly indices: Uint32Array;
}

const COORDINATES_PER_VERTEX = 2;

function quantized(metres: number): number {
  return Math.round(metres / STREET_MESH_UNIT_M);
}

/** Every water polygon of a tile triangulated into one mesh, y north in plan becoming z south on the ground. */
export function waterTileMesh(polygons: MultiPolygon): WaterMesh {
  const mesh = triangulateMultiPolygon(polygons);
  const positions = new Int16Array(mesh.positions.length);
  for (let index = 0; index < mesh.positions.length; index += COORDINATES_PER_VERTEX) {
    positions[index] = quantized(mesh.positions[index]);
    positions[index + 1] = quantized(-mesh.positions[index + 1]);
  }
  return { positions, indices: mesh.indices };
}
