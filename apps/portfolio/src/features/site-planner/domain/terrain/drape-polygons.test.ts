import { describe, expect, it } from 'vitest';

import type { MultiPolygon } from '../geometry/polygon-types';
import type { Meters } from '../units';
import { drapePolygons } from './drape-polygons';
import type { Heightfield } from './heightfield';
import { createHeightfieldForBounds, sampleHeight } from './heightfield';

const WORLD_COORDINATES_PER_VERTEX = 3;
const OFFSET_METERS: Meters = 0.04;

/** A 10 × 10 m grid whose elevation is decided by the sample's plan position. */
function fieldOf(elevationAt: (x: Meters, y: Meters) => Meters): Heightfield {
  const field = createHeightfieldForBounds({ minX: 0, minY: 0, maxX: 10, maxY: 10 }, 11);

  for (let row = 0; row < field.resolution; row += 1) {
    for (let column = 0; column < field.resolution; column += 1) {
      field.heights[row * field.resolution + column] = elevationAt(
        field.originMeters.x + column * field.cellSizeMeters,
        field.originMeters.y + row * field.cellSizeMeters
      );
    }
  }

  return field;
}

/** A 4 × 2 m rectangle inside the grid. */
const RIBBON: MultiPolygon = [
  {
    outer: [
      { x: 2, y: 4 },
      { x: 6, y: 4 },
      { x: 6, y: 6 },
      { x: 2, y: 6 },
    ],
    holes: [],
  },
];

describe('drapePolygons', () => {
  it('lifts every vertex onto the terrain by the offset it is given', () => {
    const field = fieldOf(x => x * 0.2);
    const mesh = drapePolygons({ polygons: RIBBON, field, elevationOffset: OFFSET_METERS });

    expect(mesh.indices.length).toBeGreaterThan(0);

    for (let offset = 0; offset < mesh.positions.length; offset += WORLD_COORDINATES_PER_VERTEX) {
      const planX = mesh.positions[offset];
      // World +Z runs south, so plan north is read back as its negation.
      const planY = -mesh.positions[offset + 2];

      expect(mesh.positions[offset + 1]).toBeCloseTo(
        sampleHeight(field, planX, planY) + OFFSET_METERS
      );
    }
  });

  it('splits long edges so the ribbon follows the ground between its corners', () => {
    const field = fieldOf(() => 0);
    const mesh = drapePolygons({ polygons: RIBBON, field, elevationOffset: OFFSET_METERS });

    // Four corners alone would be four vertices; the cell size is 1 m.
    expect(mesh.positions.length / WORLD_COORDINATES_PER_VERTEX).toBeGreaterThan(8);
  });

  it('faces straight up over level ground', () => {
    const mesh = drapePolygons({
      polygons: RIBBON,
      field: fieldOf(() => 3),
      elevationOffset: OFFSET_METERS,
    });

    for (let offset = 0; offset < mesh.normals.length; offset += WORLD_COORDINATES_PER_VERTEX) {
      expect(mesh.normals[offset]).toBeCloseTo(0);
      expect(mesh.normals[offset + 1]).toBeCloseTo(1);
      expect(mesh.normals[offset + 2]).toBeCloseTo(0);
    }
  });

  it('leans its normals into a slope that rises to the east', () => {
    const mesh = drapePolygons({
      polygons: RIBBON,
      field: fieldOf(x => x),
      elevationOffset: OFFSET_METERS,
    });
    const halfRoot = Math.SQRT1_2;

    for (let offset = 0; offset < mesh.normals.length; offset += WORLD_COORDINATES_PER_VERTEX) {
      expect(mesh.normals[offset]).toBeCloseTo(-halfRoot);
      expect(mesh.normals[offset + 1]).toBeCloseTo(halfRoot);
    }
  });

  it('drapes nothing when there is no ribbon', () => {
    const mesh = drapePolygons({
      polygons: [],
      field: fieldOf(() => 0),
      elevationOffset: OFFSET_METERS,
    });

    expect(mesh.indices).toHaveLength(0);
    expect(mesh.positions).toHaveLength(0);
  });
});
