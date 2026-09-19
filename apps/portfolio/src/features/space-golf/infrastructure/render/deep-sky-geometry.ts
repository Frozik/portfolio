import type { Vector2 } from '@frozik/utils/math/vector2';

import type { DeepSky, DeepSkyObject } from './deep-sky';
import { brightnessOf } from './deep-sky';
import type { FramedVertex, PaintKind } from './framed-mesh-writer';
import { FramedMeshWriter } from './framed-mesh-writer';
import type { MeshData } from './mesh-writer';

/** Which painting the shader does, in the first of the kind bytes. */
const PAINT_NEBULA = 0;
const PAINT_GALAXY = 255;
const BYTE_MAX = 255;

/**
 * The deep sky as the shader is given it: one quad per far thing, carrying
 * the disc it is painted in — `along` and `across` from its middle, its own
 * half length and half width beside them — and three bytes saying which
 * painting, in which colours, and how brightly it burns just now. Everything
 * that makes a galaxy a galaxy happens in `shaders/deep-sky.wgsl`; here is
 * only where it lies and how far through its life it is.
 */
export function buildDeepSkyMesh(sky: DeepSky): MeshData {
  const writer = new FramedMeshWriter();
  for (const object of sky.objects) {
    const burning = brightnessOf(object);
    if (burning <= 0) {
      continue;
    }
    const halfLength = object.radiusMeters;
    const halfWidth = object.radiusMeters * object.squash;
    const corner = (along: number, across: number): FramedVertex => ({
      position: onSky(object, { x: along, y: across }),
      along,
      across,
    });
    writer.quad(
      [
        corner(-halfLength, -halfWidth),
        corner(halfLength, -halfWidth),
        corner(halfLength, halfWidth),
        corner(-halfLength, halfWidth),
      ],
      { length: halfLength, width: halfWidth },
      kindOf(object, burning)
    );
  }
  return writer.finish();
}

function kindOf(object: DeepSkyObject, burning: number): PaintKind {
  return [
    object.kind === 'galaxy' ? PAINT_GALAXY : PAINT_NEBULA,
    Math.round(object.tint * BYTE_MAX),
    Math.round(burning * BYTE_MAX),
    0,
  ];
}

/** A point of the object's own frame — its long way, its short way — where it lies on the board. */
function onSky(object: DeepSkyObject, local: Vector2): Vector2 {
  const [turned, leaned] = [Math.cos(object.turn), Math.sin(object.turn)];
  return {
    x: object.position.x + local.x * turned - local.y * leaned,
    y: object.position.y + local.x * leaned + local.y * turned,
  };
}
