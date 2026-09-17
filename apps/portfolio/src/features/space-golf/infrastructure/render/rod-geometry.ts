import type { Vector2 } from '@frozik/utils/math/vector2';

import { assertNever } from '@frozik/utils/assert/assertNever';

import type { Level, Rod, RodKind } from '../../domain/level';
import { rodShape, rodTipLength, rodWidth } from '../../domain/rods';
import { add, rightNormal, scale, subtract } from '../../domain/vector';
import type { MeshData, Rgba } from './mesh-writer';
import { MeshWriter } from './mesh-writer';
import { PALETTE } from './palette';

/** Where across the rod the highlight runs: the light falls from the rod's left side. */
const HIGHLIGHT_SHARE = 0.35;
/** The screw's thread: one turn every pitch along the rod, each cut as a slanted dark groove across the shaft. */
const THREAD_PITCH_METERS = 0.08;
const THREAD_WIDTH_METERS = 0.014;
/** How far along the rod a groove climbs from one edge to the other — the helix seen from the side. */
const THREAD_SLANT_METERS = 0.03;

/** The three tones a rod is shaded with, by kind. */
interface Tones {
  readonly dark: Rgba;
  readonly mid: Rgba;
  readonly light: Rgba;
}

export function rodTones(kind: RodKind): Tones {
  switch (kind) {
    case 'slide':
      return { dark: PALETTE.steelDark, mid: PALETTE.steel, light: PALETTE.steelLight };
    case 'screw':
      return { dark: PALETTE.brassDark, mid: PALETTE.brass, light: PALETTE.brassLight };
    default:
      return assertNever(kind);
  }
}

/**
 * The rods where they stand this frame, drawn under the islands so the part
 * still inside a wall is hidden by it: a bar shaded across, dark at one
 * edge, bright along a line off centre, dark again at the other edge, so it
 * reads as round, ending in a pointed tip shaded the same way. A screw rod
 * is brass with a thread of slanted grooves along its shaft.
 */
export function buildRodMesh(level: Level, extensions: readonly number[]): MeshData {
  const writer = new MeshWriter();
  level.rods.forEach((rod, index) => {
    const shape = rodShape(rod, extensions[index]);
    const [tailLeft, tailRight, shoulderRight, tip, shoulderLeft] = shape.vertices;
    const tones = rodTones(rod.kind);
    const side = scale(rightNormal(rod.direction), rodWidth(rod.kind));
    const highlightTail = add(tailLeft, scale(side, HIGHLIGHT_SHARE));
    const highlightShoulder = add(shoulderLeft, scale(side, HIGHLIGHT_SHARE));
    writeStrip(
      writer,
      tailLeft,
      shoulderLeft,
      highlightTail,
      highlightShoulder,
      tones.dark,
      tones.light
    );
    writeStrip(
      writer,
      highlightTail,
      highlightShoulder,
      tailRight,
      shoulderRight,
      tones.light,
      tones.dark
    );
    writer.shadedTriangle(shoulderLeft, tip, highlightShoulder, [
      tones.dark,
      tones.mid,
      tones.light,
    ]);
    writer.shadedTriangle(highlightShoulder, tip, shoulderRight, [
      tones.light,
      tones.mid,
      tones.dark,
    ]);
    if (rod.kind === 'screw') {
      writeThread(writer, rod, extensions[index]);
    }
  });
  return writer.finish();
}

/** Slanted grooves from the base to the shoulder, one per pitch, so the shaft reads as threaded. */
function writeThread(writer: MeshWriter, rod: Rod, extension: number): void {
  const half = rodWidth(rod.kind) / 2;
  const side = scale(rightNormal(rod.direction), half);
  const shoulder = extension - rodTipLength(rod.kind);
  for (let along = THREAD_PITCH_METERS / 2; along < shoulder; along += THREAD_PITCH_METERS) {
    const left = subtract(add(rod.base, scale(rod.direction, along)), side);
    const right = add(add(rod.base, scale(rod.direction, along + THREAD_SLANT_METERS)), side);
    writer.segment(left, right, THREAD_WIDTH_METERS, PALETTE.thread);
  }
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
