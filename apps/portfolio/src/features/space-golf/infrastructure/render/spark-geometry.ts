import type { Vector2 } from '@frozik/utils/math/vector2';

import type { MeshWriter, Rgba } from './mesh-writer';
import { withAlpha } from './palette';

/** A four-pointed star: long arms from a narrow waist. */
const STAR_TIPS = 4;
const STAR_WAIST_SHARE = 0.3;
const HAZE_SEGMENTS = 24;
const HAZE_BREATH_SHARE = 0.08;
const HAZE_BREATH_RADIANS_PER_SECOND = 3.4;
const HALF = 0.5;
const FULL_TURN = Math.PI * 2;

/** The sparkle of the gold: a four-pointed star, turned as it pleases. */
export function writeStar(
  writer: MeshWriter,
  at: Vector2,
  star: { readonly radius: number; readonly turn: number; readonly color: Rgba }
): void {
  const corners = STAR_TIPS * 2;
  const radiusOf = (corner: number): number =>
    corner % 2 === 0 ? star.radius : star.radius * STAR_WAIST_SHARE;
  for (let corner = 0; corner < corners; corner += 1) {
    const from = star.turn + (corner / corners) * FULL_TURN;
    const to = star.turn + ((corner + 1) / corners) * FULL_TURN;
    writer.triangle(
      at,
      around(at, from, radiusOf(corner)),
      around(at, to, radiusOf(corner + 1)),
      star.color
    );
  }
}

/** A disc with no edge: the colour full in the middle and gone at the rim, breathing. */
export function writeHaze(
  writer: MeshWriter,
  center: Vector2,
  haze: {
    readonly radius: number;
    readonly color: Rgba;
    readonly alpha: number;
    readonly timeSeconds: number;
  }
): void {
  const radius =
    haze.radius *
    (1 + HAZE_BREATH_SHARE * Math.sin(haze.timeSeconds * HAZE_BREATH_RADIANS_PER_SECOND));
  const middle = withAlpha(haze.color, haze.alpha);
  const rim = withAlpha(haze.color, 0);
  for (let index = 0; index < HAZE_SEGMENTS; index += 1) {
    const from = (index / HAZE_SEGMENTS) * FULL_TURN;
    const to = ((index + 1) / HAZE_SEGMENTS) * FULL_TURN;
    writer.shadedTriangle(center, around(center, from, radius), around(center, to, radius), [
      middle,
      rim,
      rim,
    ]);
  }
}

/** How brightly a spark stands this moment: each has its own place in the twinkle. */
export function twinkle(timeSeconds: number, offset: number, radiansPerSecond: number): number {
  return HALF + HALF * Math.sin(timeSeconds * radiansPerSecond + offset * FULL_TURN);
}

export function around(center: Vector2, angle: number, radius: number): Vector2 {
  return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
}
