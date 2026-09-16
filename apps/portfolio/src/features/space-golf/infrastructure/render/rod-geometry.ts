import type { Vector2 } from '@frozik/utils/math/vector2';

import { ROD_WIDTH_METERS } from '../../domain/constants';
import type { Level } from '../../domain/level';
import { rodShape } from '../../domain/rods';
import { add, rightNormal, scale } from '../../domain/vector';
import type { MeshData, Rgba } from './mesh-writer';
import { MeshWriter } from './mesh-writer';
import { PALETTE } from './palette';

/** Where across the rod the highlight runs: the light falls from the rod's left side. */
const HIGHLIGHT_SHARE = 0.35;

/**
 * The rods where they stand this frame, drawn under the islands so the part
 * still inside a wall is hidden by it: a steel bar shaded across, dark at one
 * edge, bright along a line off centre, dark again at the other edge, so it
 * reads as round, ending in a pointed tip shaded the same way.
 */
export function buildRodMesh(level: Level, extensions: readonly number[]): MeshData {
  const writer = new MeshWriter();
  level.rods.forEach((rod, index) => {
    const shape = rodShape(rod, extensions[index]);
    const [tailLeft, tailRight, shoulderRight, tip, shoulderLeft] = shape.vertices;
    const side = scale(rightNormal(rod.direction), ROD_WIDTH_METERS);
    const highlightTail = add(tailLeft, scale(side, HIGHLIGHT_SHARE));
    const highlightShoulder = add(shoulderLeft, scale(side, HIGHLIGHT_SHARE));
    writeStrip(
      writer,
      tailLeft,
      shoulderLeft,
      highlightTail,
      highlightShoulder,
      PALETTE.steelDark,
      PALETTE.steelLight
    );
    writeStrip(
      writer,
      highlightTail,
      highlightShoulder,
      tailRight,
      shoulderRight,
      PALETTE.steelLight,
      PALETTE.steelDark
    );
    writer.shadedTriangle(shoulderLeft, tip, highlightShoulder, [
      PALETTE.steelDark,
      PALETTE.steel,
      PALETTE.steelLight,
    ]);
    writer.shadedTriangle(highlightShoulder, tip, shoulderRight, [
      PALETTE.steelLight,
      PALETTE.steel,
      PALETTE.steelDark,
    ]);
  });
  return writer.finish();
}

/** A quad between two long edges, each in its own colour, blended across. */
function writeStrip(
  writer: MeshWriter,
  fromA: Vector2,
  toA: Vector2,
  fromB: Vector2,
  toB: Vector2,
  colorA: Rgba,
  colorB: Rgba
): void {
  writer.shadedTriangle(fromA, toA, toB, [colorA, colorA, colorB]);
  writer.shadedTriangle(fromA, toB, fromB, [colorA, colorB, colorB]);
}
