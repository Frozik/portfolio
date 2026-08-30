import earcut from 'earcut';

import type { MultiPolygon, PolygonWithHoles, Ring, TriangleMesh } from './polygon-types';

const COORDINATES_PER_VERTEX = 2;
const MIN_RING_VERTEX_COUNT = 3;

const EMPTY_MESH: TriangleMesh = {
  positions: new Float32Array(0),
  indices: new Uint32Array(0),
};

/**
 * Triangulates one polygon with holes into a mesh ready for a GPU buffer pair.
 * Holes are handed to earcut as start indices into the shared vertex list, which
 * is the representation it triangulates directly.
 */
export function triangulatePolygon({ outer, holes }: PolygonWithHoles): TriangleMesh {
  if (outer.length < MIN_RING_VERTEX_COUNT) {
    return EMPTY_MESH;
  }

  const coordinates: number[] = [];

  appendRing(coordinates, outer);

  const holeStartIndices: number[] = [];

  for (const hole of holes) {
    if (hole.length < MIN_RING_VERTEX_COUNT) {
      continue;
    }

    holeStartIndices.push(coordinates.length / COORDINATES_PER_VERTEX);
    appendRing(coordinates, hole);
  }

  const indices = earcut(coordinates, holeStartIndices, COORDINATES_PER_VERTEX);

  return {
    positions: new Float32Array(coordinates),
    indices: new Uint32Array(indices),
  };
}

/**
 * Triangulates every polygon of a multi-polygon into one mesh, so a plot split
 * into several rings still reaches the GPU as a single buffer pair. Each
 * polygon's indices are shifted by the vertices already written.
 */
export function triangulateMultiPolygon(polygons: MultiPolygon): TriangleMesh {
  const meshes = polygons.map(triangulatePolygon);
  const vertexCount = meshes.reduce(
    (total, mesh) => total + mesh.positions.length / COORDINATES_PER_VERTEX,
    0
  );
  const indexCount = meshes.reduce((total, mesh) => total + mesh.indices.length, 0);

  const positions = new Float32Array(vertexCount * COORDINATES_PER_VERTEX);
  const indices = new Uint32Array(indexCount);

  let positionOffset = 0;
  let indexOffset = 0;
  let vertexOffset = 0;

  for (const mesh of meshes) {
    positions.set(mesh.positions, positionOffset);

    for (let index = 0; index < mesh.indices.length; index += 1) {
      indices[indexOffset + index] = mesh.indices[index] + vertexOffset;
    }

    positionOffset += mesh.positions.length;
    indexOffset += mesh.indices.length;
    vertexOffset += mesh.positions.length / COORDINATES_PER_VERTEX;
  }

  return { positions, indices };
}

function appendRing(coordinates: number[], ring: Ring): void {
  for (const point of ring) {
    coordinates.push(point.x, point.y);
  }
}
