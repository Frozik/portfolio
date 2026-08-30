import { describe, expect, it } from 'vitest';

import type { ColoredMesh } from './lit-mesh';
import { buildTreeTemplate } from './tree-mesh';

const COORDINATES_PER_VERTEX = 3;
const VERTICES_PER_TRIANGLE = 3;
/** The templates are authored in exact halves and turns; float slop stays tiny. */
const TOLERANCE = 1e-6;

const SPECIES = ['spruce', 'pine', 'thuja', 'deciduous'] as const;

/** Bark: the one colour every species carries, whatever its foliage. */
function barkColor(): string {
  const [shared] = [...collectColors(buildTreeTemplate('spruce'))].filter(color =>
    collectColors(buildTreeTemplate('deciduous')).has(color)
  );

  expect(shared).toBeDefined();

  return shared;
}

/** Where the foliage of a species starts, as a fraction of the tree's height. */
function crownBottomFraction(species: (typeof SPECIES)[number]): number {
  const mesh = buildTreeTemplate(species);
  const bark = barkColor();

  let bottom = Number.POSITIVE_INFINITY;

  for (let index = 0; index < mesh.positions.length / COORDINATES_PER_VERTEX; index += 1) {
    if (readVertex(mesh.colors, index).join() !== bark) {
      bottom = Math.min(bottom, readVertex(mesh.positions, index)[1]);
    }
  }

  return bottom;
}

interface Face {
  readonly normal: readonly [number, number, number];
  readonly centroid: readonly [number, number, number];
}

function readVertex(source: Float32Array, index: number): [number, number, number] {
  const offset = index * COORDINATES_PER_VERTEX;

  return [source[offset], source[offset + 1], source[offset + 2]];
}

function readFaces(mesh: ColoredMesh): readonly Face[] {
  const faces: Face[] = [];

  for (let offset = 0; offset < mesh.indices.length; offset += VERTICES_PER_TRIANGLE) {
    const corners = [
      readVertex(mesh.positions, mesh.indices[offset]),
      readVertex(mesh.positions, mesh.indices[offset + 1]),
      readVertex(mesh.positions, mesh.indices[offset + 2]),
    ];

    faces.push({
      normal: readVertex(mesh.normals, mesh.indices[offset]),
      centroid: [
        corners.reduce((total, corner) => total + corner[0], 0) / VERTICES_PER_TRIANGLE,
        corners.reduce((total, corner) => total + corner[1], 0) / VERTICES_PER_TRIANGLE,
        corners.reduce((total, corner) => total + corner[2], 0) / VERTICES_PER_TRIANGLE,
      ],
    });
  }

  return faces;
}

function collectColors(mesh: ColoredMesh): ReadonlySet<string> {
  const colors = new Set<string>();

  for (let offset = 0; offset < mesh.colors.length; offset += COORDINATES_PER_VERTEX) {
    colors.add([mesh.colors[offset], mesh.colors[offset + 1], mesh.colors[offset + 2]].join());
  }

  return colors;
}

describe('buildTreeTemplate', () => {
  it.each(SPECIES)('stands %s on the origin within a unit crown and a unit height', species => {
    const mesh = buildTreeTemplate(species);
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    let maxHorizontalRadius = 0;

    for (let index = 0; index < mesh.positions.length; index += COORDINATES_PER_VERTEX) {
      const [x, y, z] = [
        mesh.positions[index],
        mesh.positions[index + 1],
        mesh.positions[index + 2],
      ];

      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      maxHorizontalRadius = Math.max(maxHorizontalRadius, Math.hypot(x, z));
    }

    expect(minY).toBeCloseTo(0);
    expect(maxY).toBeCloseTo(1);
    expect(maxHorizontalRadius).toBeLessThanOrEqual(1 + TOLERANCE);
    expect(maxHorizontalRadius).toBeCloseTo(1);
  });

  it.each(SPECIES)('gives %s one colour and one unit normal per position', species => {
    const mesh = buildTreeTemplate(species);
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

  it.each(SPECIES)('winds every face of %s so its normal points away from the trunk', species => {
    for (const { normal, centroid } of readFaces(buildTreeTemplate(species))) {
      expect(normal[0] * centroid[0] + normal[2] * centroid[2]).toBeGreaterThanOrEqual(-TOLERANCE);
    }
  });

  it('paints each species in its own foliage over a shared bark', () => {
    const bark = barkColor();
    const foliageColors = SPECIES.map(species => {
      const colors = collectColors(buildTreeTemplate(species));

      expect(colors.size).toBe(2);
      expect(colors.has(bark)).toBe(true);

      return [...colors].filter(color => color !== bark).join();
    });

    expect(new Set(foliageColors).size).toBe(SPECIES.length);
  });

  it('carries the pine on a bare trunk and the spruce on a skirt to the ground', () => {
    // The pine's needles start high above the ground, the spruce's low: it is
    // the one proportion that tells the two silhouettes apart at plot scale.
    expect(crownBottomFraction('pine')).toBeGreaterThan(0.5);
    expect(crownBottomFraction('spruce')).toBeLessThan(0.2);
  });

  it('stands the thuja up as a column of foliage', () => {
    // Nearly the whole height is crown, which is what makes it read as a column
    // rather than as a crown on a trunk the way the broadleaf does.
    expect(crownBottomFraction('thuja')).toBeLessThan(0.1);
    expect(crownBottomFraction('deciduous')).toBeGreaterThan(0.2);
  });
});
