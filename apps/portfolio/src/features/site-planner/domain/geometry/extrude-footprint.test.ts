import { describe, expect, it } from 'vitest';

import { extrudeFootprint } from './extrude-footprint';
import type { LitMesh } from './lit-mesh';
import type { MultiPolygon, Ring } from './polygon-types';

const WORLD_COORDINATES_PER_VERTEX = 3;
const INDICES_PER_TRIANGLE = 3;

const PAD_ELEVATION = 10;
const WALL_HEIGHT = 3;
const APRON_BASE_ELEVATION = 9.5;
const ROOF_ELEVATION = PAD_ELEVATION + WALL_HEIGHT;

/** Counter-clockwise, as the boolean fold leaves an outer ring. */
function rectangle(minX: number, minY: number, maxX: number, maxY: number): Ring {
  return [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
}

/** Clockwise, as the boolean fold leaves a hole. */
function reversedRectangle(minX: number, minY: number, maxX: number, maxY: number): Ring {
  return [...rectangle(minX, minY, maxX, maxY)].reverse();
}

function extrudeSquare(polygons: MultiPolygon): LitMesh {
  return extrudeFootprint({
    polygons,
    padElevation: PAD_ELEVATION,
    wallHeight: WALL_HEIGHT,
    apronBaseElevation: APRON_BASE_ELEVATION,
  });
}

function vertexAt(mesh: LitMesh, index: number): readonly [number, number, number] {
  const offset = index * WORLD_COORDINATES_PER_VERTEX;

  return [mesh.positions[offset], mesh.positions[offset + 1], mesh.positions[offset + 2]];
}

function normalAt(mesh: LitMesh, index: number): readonly [number, number, number] {
  const offset = index * WORLD_COORDINATES_PER_VERTEX;

  return [mesh.normals[offset], mesh.normals[offset + 1], mesh.normals[offset + 2]];
}

function countVertices(mesh: LitMesh): number {
  return mesh.positions.length / WORLD_COORDINATES_PER_VERTEX;
}

describe('extrudeFootprint', () => {
  const squarePolygons: MultiPolygon = [{ outer: rectangle(0, 0, 10, 10), holes: [] }];

  it('caps a square footprint with two roof triangles and bands each of its four edges', () => {
    const mesh = extrudeSquare(squarePolygons);

    // Two triangles cap the square, and every edge raises a wall quad and an
    // apron quad — two triangles each.
    const roofTriangles = 2;
    const bandTriangles = 4 * 2 * 2;

    expect(mesh.indices.length / INDICES_PER_TRIANGLE).toBe(roofTriangles + bandTriangles);
  });

  it('keeps positions, normals and indices consistent', () => {
    const mesh = extrudeSquare(squarePolygons);

    expect(mesh.normals.length).toBe(mesh.positions.length);

    for (const index of mesh.indices) {
      expect(index).toBeLessThan(countVertices(mesh));
    }
  });

  it('lays the roof flat at the top of the walls, facing up', () => {
    const mesh = extrudeSquare(squarePolygons);
    const roofVertexIndices = [...mesh.indices].filter(index => normalAt(mesh, index)[1] > 0);

    expect(roofVertexIndices.length).toBeGreaterThan(0);

    for (const index of roofVertexIndices) {
      expect(normalAt(mesh, index)).toEqual([0, 1, 0]);
      expect(vertexAt(mesh, index)[1]).toBeCloseTo(ROOF_ELEVATION);
    }
  });

  it('spans from the apron base to the roof and no further', () => {
    const mesh = extrudeSquare(squarePolygons);

    let lowest = Number.POSITIVE_INFINITY;
    let highest = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < countVertices(mesh); index += 1) {
      const [, elevation] = vertexAt(mesh, index);

      lowest = Math.min(lowest, elevation);
      highest = Math.max(highest, elevation);
    }

    expect(lowest).toBeCloseTo(APRON_BASE_ELEVATION);
    expect(highest).toBeCloseTo(ROOF_ELEVATION);
  });

  it('points every wall normal away from the middle of the footprint', () => {
    const mesh = extrudeSquare(squarePolygons);
    // The plan centre (5, 5) is world (5, ·, -5).
    const centerX = 5;
    const centerZ = -5;

    for (let index = 0; index < countVertices(mesh); index += 1) {
      const [normalX, normalY, normalZ] = normalAt(mesh, index);

      if (normalY !== 0) {
        continue;
      }

      const [x, , z] = vertexAt(mesh, index);

      expect(Math.hypot(normalX, normalZ)).toBeCloseTo(1);
      expect(normalX * (x - centerX) + normalZ * (z - centerZ)).toBeGreaterThan(0);
    }
  });

  it('turns the normals of a hole inwards, away from the material around it', () => {
    const mesh = extrudeSquare([
      { outer: rectangle(0, 0, 10, 10), holes: [reversedRectangle(4, 4, 6, 6)] },
    ]);
    const holeCenterX = 5;
    const holeCenterZ = -5;
    let holeWallVertexCount = 0;

    for (let index = 0; index < countVertices(mesh); index += 1) {
      const [normalX, normalY, normalZ] = normalAt(mesh, index);
      const [x, , z] = vertexAt(mesh, index);
      const isOnHoleRing = x >= 4 && x <= 6 && z >= -6 && z <= -4;

      if (normalY !== 0 || !isOnHoleRing) {
        continue;
      }

      holeWallVertexCount += 1;
      expect(normalX * (x - holeCenterX) + normalZ * (z - holeCenterZ)).toBeLessThan(0);
    }

    expect(holeWallVertexCount).toBeGreaterThan(0);
  });

  it('leaves out the apron when the ground already reaches the pad', () => {
    const withoutApron = extrudeFootprint({
      polygons: squarePolygons,
      padElevation: PAD_ELEVATION,
      wallHeight: WALL_HEIGHT,
      apronBaseElevation: PAD_ELEVATION,
    });

    const roofTriangles = 2;
    const wallTriangles = 4 * 2;

    expect(withoutApron.indices.length / INDICES_PER_TRIANGLE).toBe(roofTriangles + wallTriangles);
  });

  it('has nothing to extrude without a footprint', () => {
    const mesh = extrudeSquare([]);

    expect(mesh.positions.length).toBe(0);
    expect(mesh.normals.length).toBe(0);
    expect(mesh.indices.length).toBe(0);
  });
});
