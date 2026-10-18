import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Vector2 } from '@frozik/utils/math/vector2';

import { createRandom } from '../../domain/generator/random';
import type { Splash, SplashMaterial } from '../../domain/splash';
import { SPLASH_SECONDS } from '../../domain/splash';
import type { MeshWriter, Rgba } from './mesh-writer';
import { PALETTE, withAlpha } from './palette';

const MIN_DROPS = 4;
const MAX_DROPS = 10;
/** Drops leave the surface within this angle either side of its normal: a puddle throws up, not sideways. */
const SPREAD_RADIANS = 1.1;
const MIN_DROP_SPEED_METERS_PER_SECOND = 1;
const MAX_DROP_SPEED_METERS_PER_SECOND = 2.6;
/** A few pixels across at the home zoom: smaller vanishes, the ball itself is nine. */
const MIN_DROP_RADIUS_METERS = 0.018;
const MAX_DROP_RADIUS_METERS = 0.032;
/** Even the softest landing throws its drops this share of the full speed: a weaker splash is a smaller one, not an invisible one. */
const SOFTEST_SPEED_SHARE = 0.5;
/** The air slows a drop fast, so the splash stays a puddle's width — a few ball widths at the hardest landing. */
const DRAG_PER_SECOND = 4;
/** What pulls a drop back to the surface it left, whichever way that faces. */
const SAG_METERS_PER_SECOND_SQUARED = 3;
/** A drop shrinks to this share of its size as it fades. */
const LAST_SIZE_SHARE = 0.5;
const HALF = 0.5;

/** The drops of every live splash, each where its flight has taken it, fading out over the splash's second. */
export function writeSplashes(writer: MeshWriter, splashes: readonly Splash[]): void {
  for (const splash of splashes) {
    writeSplash(writer, splash);
  }
}

function writeSplash(writer: MeshWriter, splash: Splash): void {
  const random = createRandom(splash.seed);
  const time = splash.elapsedSeconds;
  const progress = Math.min(1, time / SPLASH_SECONDS);
  const color = dropColor(splash.material);
  const faded = withAlpha(color, color[3] * (1 - progress));
  const tangent: Vector2 = { x: -splash.normal.y, y: splash.normal.x };
  const drops = Math.round(MIN_DROPS + (MAX_DROPS - MIN_DROPS) * splash.strength);
  const travel = (1 - Math.exp(-DRAG_PER_SECOND * time)) / DRAG_PER_SECOND;
  const sag = HALF * SAG_METERS_PER_SECOND_SQUARED * time * time;
  const size = 1 - (1 - LAST_SIZE_SHARE) * progress;
  for (let index = 0; index < drops; index += 1) {
    const tilt = (random.next() * 2 - 1) * SPREAD_RADIANS;
    const speed =
      (SOFTEST_SPEED_SHARE + (1 - SOFTEST_SPEED_SHARE) * splash.strength) *
      (MIN_DROP_SPEED_METERS_PER_SECOND +
        random.next() * (MAX_DROP_SPEED_METERS_PER_SECOND - MIN_DROP_SPEED_METERS_PER_SECOND));
    const radius =
      MIN_DROP_RADIUS_METERS + random.next() * (MAX_DROP_RADIUS_METERS - MIN_DROP_RADIUS_METERS);
    const along = Math.sin(tilt) * speed * travel;
    // A drop that falls back lies on the face it left until the splash fades.
    const height = Math.max(0, Math.cos(tilt) * speed * travel - sag);
    writer.circle(
      {
        x: splash.point.x + tangent.x * along + splash.normal.x * height,
        y: splash.point.y + tangent.y * along + splash.normal.y * height,
      },
      radius * size,
      faded
    );
  }
}

function dropColor(material: SplashMaterial): Rgba {
  switch (material) {
    case 'island':
      return PALETTE.islandDrop;
    case 'bounce':
      return PALETTE.elasticDrop;
    case 'sticky':
      return PALETTE.viscousDrop;
    default:
      return assertNever(material);
  }
}
