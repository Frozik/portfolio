import { describe, expect, it } from 'vitest';

import type { LocalPoint, Rgb } from './mesh-builder';
import { appendQuad, appendTriangle, createMeshBuilder, finishColoredMesh } from './mesh-builder';

const COLOR: Rgb = [0.25, 0.5, 0.75];
const COORDINATES_PER_VERTEX = 3;
const VERTICES_PER_TRIANGLE = 3;

/** A triangle in the ground plane, wound counter-clockwise seen from above. */
const GROUND_TRIANGLE: readonly LocalPoint[] = [
  [0, 0, 0],
  [1, 0, 0],
  [0, 0, -1],
];

describe('mesh builder', () => {
  it('takes the normal of a face from its winding', () => {
    const builder = createMeshBuilder();
    const [first, second, third] = GROUND_TRIANGLE;

    appendTriangle(builder, first, second, third, COLOR);

    const mesh = finishColoredMesh(builder);

    expect(mesh.indices).toEqual(Uint32Array.from([0, 1, 2]));
    expect(mesh.normals[0]).toBeCloseTo(0);
    expect(mesh.normals[1]).toBeCloseTo(1);
    expect(mesh.normals[2]).toBeCloseTo(0);
    expect([...mesh.colors.slice(0, COORDINATES_PER_VERTEX)]).toEqual([...COLOR]);
  });

  it('drops a face with no area to take a direction from', () => {
    const builder = createMeshBuilder();

    appendTriangle(builder, [0, 0, 0], [1, 0, 0], [2, 0, 0], COLOR);

    const mesh = finishColoredMesh(builder);

    expect(mesh.indices).toHaveLength(0);
    expect(mesh.positions).toHaveLength(0);
  });

  it('splits a quad into two faces of the same winding', () => {
    const builder = createMeshBuilder();

    appendQuad(builder, [0, 0, 0], [1, 0, 0], [1, 0, -1], [0, 0, -1], COLOR);

    const mesh = finishColoredMesh(builder);

    expect(mesh.indices).toHaveLength(2 * VERTICES_PER_TRIANGLE);

    for (let index = 0; index < mesh.normals.length; index += COORDINATES_PER_VERTEX) {
      expect(mesh.normals[index + 1]).toBeCloseTo(1);
    }
  });
});
