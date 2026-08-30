import { describe, expect, it } from 'vitest';

import { CAR_HEIGHT_METERS, CAR_LENGTH_METERS, CAR_WIDTH_METERS } from '../constants';
import { buildCarTemplate } from './car-mesh';

const COORDINATES_PER_VERTEX = 3;
const VERTICES_PER_TRIANGLE = 3;
const TOLERANCE = 1e-6;
const HALF = 0.5;

function readVertex(source: Float32Array, index: number): [number, number, number] {
  const offset = index * COORDINATES_PER_VERTEX;

  return [source[offset], source[offset + 1], source[offset + 2]];
}

function collectColors(colors: Float32Array): ReadonlySet<string> {
  const collected = new Set<string>();

  for (let offset = 0; offset < colors.length; offset += COORDINATES_PER_VERTEX) {
    collected.add([colors[offset], colors[offset + 1], colors[offset + 2]].join());
  }

  return collected;
}

describe('buildCarTemplate', () => {
  it('stands the car on y = 0 inside the size every car on the plan has', () => {
    const mesh = buildCarTemplate();
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let maxLengthOffset = 0;
    let maxWidthOffset = 0;

    for (let index = 0; index < mesh.positions.length; index += COORDINATES_PER_VERTEX) {
      const [x, y, z] = [
        mesh.positions[index],
        mesh.positions[index + 1],
        mesh.positions[index + 2],
      ];

      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      maxLengthOffset = Math.max(maxLengthOffset, Math.abs(x));
      maxWidthOffset = Math.max(maxWidthOffset, Math.abs(z));
    }

    expect(minY).toBeCloseTo(0);
    expect(maxY).toBeCloseTo(CAR_HEIGHT_METERS);
    expect(maxLengthOffset).toBeCloseTo(CAR_LENGTH_METERS * HALF);
    expect(maxWidthOffset).toBeLessThanOrEqual(CAR_WIDTH_METERS * HALF + TOLERANCE);
    expect(maxWidthOffset).toBeCloseTo(CAR_WIDTH_METERS * HALF);
  });

  it('gives one colour and one unit normal per position', () => {
    const mesh = buildCarTemplate();
    const vertexCount = mesh.positions.length / COORDINATES_PER_VERTEX;

    expect(mesh.normals.length).toBe(mesh.positions.length);
    expect(mesh.colors.length).toBe(mesh.positions.length);
    expect(mesh.indices.length % VERTICES_PER_TRIANGLE).toBe(0);
    expect(mesh.indices.length).toBeGreaterThan(0);
    expect(Math.max(...mesh.indices)).toBeLessThan(vertexCount);

    for (let index = 0; index < vertexCount; index += 1) {
      const [x, y, z] = readVertex(mesh.normals, index);

      expect(Math.hypot(x, y, z)).toBeCloseTo(1);
    }
  });

  it('paints a body, its glass, tyres, cladding and brightwork', () => {
    // Body, glass, tyres, the matte cladding and the trim/light bars.
    expect(collectColors(buildCarTemplate().colors).size).toBe(5);
  });

  it('sets the cabin back from the middle, so the nose reads at +x', () => {
    const mesh = buildCarTemplate();
    let roofFront = Number.NEGATIVE_INFINITY;
    let roofRear = Number.POSITIVE_INFINITY;

    for (let index = 0; index < mesh.positions.length; index += COORDINATES_PER_VERTEX) {
      if (Math.abs(mesh.positions[index + 1] - CAR_HEIGHT_METERS) > TOLERANCE) {
        continue;
      }

      roofFront = Math.max(roofFront, mesh.positions[index]);
      roofRear = Math.min(roofRear, mesh.positions[index]);
    }

    // The bonnet ahead of the cabin is longer than the boot behind it.
    expect(CAR_LENGTH_METERS * HALF - roofFront).toBeGreaterThan(
      roofRear + CAR_LENGTH_METERS * HALF
    );
  });
});
