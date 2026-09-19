import type { Vector2 } from '@frozik/utils/math/vector2';

import { assertNever } from '@frozik/utils/assert/assertNever';

import { FLOATER_LARGE_SIDE_METERS, FLOATER_SMALL_SIDE_METERS } from '../../domain/constants';
import type { Floater, Level } from '../../domain/level';
import type { FramedVertex, PaintKind } from './framed-mesh-writer';
import { FramedMeshWriter } from './framed-mesh-writer';
import type { MeshData } from './mesh-writer';

/** What the painting shader gets in the kind bytes: rows of ornament for a square, rings for a circle. */
const PAINT_ROWS: PaintKind = [0, 0, 0, 0];
const PAINT_RINGS: PaintKind = [255, 0, 0, 0];
const PLAIN_AXES: readonly [Vector2, Vector2] = [
  { x: 1, y: 0 },
  { x: 0, y: 1 },
];
const TURNED_AXES: readonly [Vector2, Vector2] = [
  { x: Math.SQRT1_2, y: Math.SQRT1_2 },
  { x: -Math.SQRT1_2, y: Math.SQRT1_2 },
];

/**
 * The floaters in their current sizes, each as one quad in its own frame:
 * `along` and `across` run from the centre along the shape's own axes —
 * turned with a diamond — so the painting turns with it. A circle gets the
 * square around it and the shader cuts the corners away.
 */
export function buildFloaterMesh(level: Level, large: readonly boolean[]): MeshData {
  const writer = new FramedMeshWriter();
  level.floaters.forEach((floater, index) => {
    const size = large[index] ? FLOATER_LARGE_SIDE_METERS : FLOATER_SMALL_SIDE_METERS;
    const half = size / 2;
    const [along, across] = axesOf(floater);
    const corner = (u: number, v: number): FramedVertex => ({
      position: {
        x: floater.center.x + along.x * u + across.x * v,
        y: floater.center.y + along.y * u + across.y * v,
      },
      along: u,
      across: v,
    });
    writer.quad(
      [corner(-half, -half), corner(half, -half), corner(half, half), corner(-half, half)],
      { length: size, width: size },
      floater.shape === 'circle' ? PAINT_RINGS : PAINT_ROWS
    );
  });
  return writer.finish();
}

function axesOf(floater: Floater): readonly [Vector2, Vector2] {
  switch (floater.shape) {
    case 'square':
    case 'circle':
      return PLAIN_AXES;
    case 'diamond':
      return TURNED_AXES;
    default:
      return assertNever(floater.shape);
  }
}
