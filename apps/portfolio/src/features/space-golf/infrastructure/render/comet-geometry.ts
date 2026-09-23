import type { Vector2 } from '@frozik/utils/math/vector2';

import type { Comet } from './comets';
import { cometHeading, cometPosition } from './comets';
import type { MeshData } from './mesh-writer';
import { MeshWriter } from './mesh-writer';
import { PALETTE, withAlpha } from './palette';
import { twinkle, writeHaze, writeStar } from './spark-geometry';

/** The head: a white-hot core in a blue-white glow. */
const CORE_RADIUS_METERS = 0.06;
const GLOW_RADIUS_METERS = 0.26;
const GLOW_ALPHA = 200;
/** The tail streams back along the way it came, this long, from the head's width to nothing. */
const TAIL_LENGTH_METERS = 2.6;
const TAIL_STEPS = 12;
const TAIL_HALF_WIDTH_METERS = 0.09;
const TAIL_HEAD_ALPHA = 210;
/** How the tail thins and fades along its length: above 1 keeps the light near the head. */
const TAIL_FADE_POWER = 1.6;
/** Sparks shed along the tail, twinkling as they fall behind. */
const TAIL_SPARKS = 3;
const SPARK_RADIUS_METERS = 0.05;
const SPARK_ALPHA = 230;
const SPARK_TWINKLE_RADIANS_PER_SECOND = 9;
const FULL_TURN = Math.PI * 2;

/** A comet on its way, drawn over the dust and under the board: the sky's own passer-by. */
export function buildCometMesh(comet: Comet | undefined, timeSeconds: number): MeshData {
  const writer = new MeshWriter();
  if (comet === undefined) {
    return writer.finish();
  }
  const head = cometPosition(comet);
  const heading = cometHeading(comet);
  writeTail(writer, head, heading);
  writeSparks(writer, head, heading, timeSeconds);
  writeHaze(writer, head, {
    radius: GLOW_RADIUS_METERS,
    color: PALETTE.comet,
    alpha: GLOW_ALPHA,
    timeSeconds,
  });
  writer.circle(head, CORE_RADIUS_METERS, PALETTE.ball);
  return writer.finish();
}

/** The tail: a ribbon streaming back from the head, thinning and fading to nothing. */
function writeTail(writer: MeshWriter, head: Vector2, heading: Vector2): void {
  const path: Vector2[] = [];
  for (let step = 0; step <= TAIL_STEPS; step += 1) {
    const back = (step / TAIL_STEPS) * TAIL_LENGTH_METERS;
    path.push({ x: head.x - heading.x * back, y: head.y - heading.y * back });
  }
  writer.ribbon(path, index => {
    const left = (1 - index / TAIL_STEPS) ** TAIL_FADE_POWER;
    return {
      halfWidth: TAIL_HALF_WIDTH_METERS * left,
      color: withAlpha(PALETTE.comet, TAIL_HEAD_ALPHA * left),
    };
  });
}

/** Sparks strewn along the tail, each at its own place behind the head and its own twinkle. */
function writeSparks(
  writer: MeshWriter,
  head: Vector2,
  heading: Vector2,
  timeSeconds: number
): void {
  for (let index = 0; index < TAIL_SPARKS; index += 1) {
    const offset = (index + 0.5) / TAIL_SPARKS;
    const back = offset * TAIL_LENGTH_METERS * 0.7;
    const aside = Math.sin(offset * FULL_TURN) * TAIL_HALF_WIDTH_METERS * 1.6;
    writeStar(
      writer,
      {
        x: head.x - heading.x * back - heading.y * aside,
        y: head.y - heading.y * back + heading.x * aside,
      },
      {
        radius: SPARK_RADIUS_METERS * (1 - offset * 0.5),
        turn: offset * FULL_TURN,
        color: withAlpha(
          PALETTE.comet,
          SPARK_ALPHA *
            (1 - offset) *
            twinkle(timeSeconds, offset, SPARK_TWINKLE_RADIANS_PER_SECOND)
        ),
      }
    );
  }
}
