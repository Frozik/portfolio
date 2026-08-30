import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { CAR_HEIGHT_METERS, CAR_LENGTH_METERS, CAR_WIDTH_METERS } from '../../domain/constants';
import { fitCarMesh } from './fit-car-mesh';
import { parseGlb } from './parse-glb';

const COORDINATES_PER_VERTEX = 3;
const UV_COMPONENTS_PER_VERTEX = 2;
const TOLERANCE = 1e-3;

function loadCarBuffer(): ArrayBuffer {
  const assetPath = join(dirname(fileURLToPath(import.meta.url)), '../assets/car-suv.glb');
  const bytes = readFileSync(assetPath);

  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

describe('parseGlb', () => {
  it('reads the bundled car into one coherent textured mesh', () => {
    const mesh = parseGlb(loadCarBuffer());
    const vertexCount = mesh.positions.length / COORDINATES_PER_VERTEX;

    expect(vertexCount).toBeGreaterThan(0);
    expect(mesh.normals.length).toBe(mesh.positions.length);
    expect(mesh.uvs.length).toBe(vertexCount * UV_COMPONENTS_PER_VERTEX);
    expect(mesh.indices.length % 3).toBe(0);
    expect(Math.max(...mesh.indices)).toBeLessThan(vertexCount);

    // The wheels ride their node translations: the mesh must spread wider than
    // any single primitive — all four corners of the car are present.
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;

    for (let offset = 2; offset < mesh.positions.length; offset += COORDINATES_PER_VERTEX) {
      minZ = Math.min(minZ, mesh.positions[offset]);
      maxZ = Math.max(maxZ, mesh.positions[offset]);
    }

    expect(maxZ - minZ).toBeGreaterThan(2);
  });
});

describe('fitCarMesh', () => {
  it('lands the car exactly in the template frame and the catalogue size', () => {
    const mesh = fitCarMesh(parseGlb(loadCarBuffer()));

    let minX = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;

    for (let offset = 0; offset < mesh.positions.length; offset += COORDINATES_PER_VERTEX) {
      minX = Math.min(minX, mesh.positions[offset]);
      maxX = Math.max(maxX, mesh.positions[offset]);
      minY = Math.min(minY, mesh.positions[offset + 1]);
      maxY = Math.max(maxY, mesh.positions[offset + 1]);
      minZ = Math.min(minZ, mesh.positions[offset + 2]);
      maxZ = Math.max(maxZ, mesh.positions[offset + 2]);
    }

    // Nose along x, wheels on the ground, centred across — and exactly the
    // constants the plan draws the car's footprint from.
    expect(maxX - minX).toBeCloseTo(CAR_LENGTH_METERS, 3);
    expect(maxZ - minZ).toBeCloseTo(CAR_WIDTH_METERS, 3);
    expect(maxY - minY).toBeCloseTo(CAR_HEIGHT_METERS, 3);
    expect(minY).toBeCloseTo(0, 3);
    expect(Math.abs(minX + maxX)).toBeLessThan(TOLERANCE);
    expect(Math.abs(minZ + maxZ)).toBeLessThan(TOLERANCE);

    // Normals come back unit length after the per-axis rescale.
    const length = Math.hypot(mesh.normals[0], mesh.normals[1], mesh.normals[2]);

    expect(length).toBeCloseTo(1, 3);
  });
});
