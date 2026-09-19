import type { Vector2 } from '@frozik/utils/math/vector2';

import { createRandom } from '../../domain/generator/random';
import type { DustWindow } from './particles';

/** How many far things are abroad at once. Most of the time none of them is on the screen, which is the point. */
const DEEP_SKY_COUNT = 3;
/** They are placed over a field this much wider than what the camera shows, so they come and go rather than stand about. */
const FIELD_FACTOR = 2.6;
const MIN_RADIUS_METERS = 2.4;
const MAX_RADIUS_METERS = 6;
/** A far thing swells in, holds and fades away over this long, then another is somewhere else. */
const LIFE_SECONDS = 42;
/** The swell is gentler than the fade, the way something drifts into the light and out of it. */
const SWELL_SHARE = 0.35;
const DRIFT_METERS_PER_SECOND = 0.02;
/**
 * How much of a pan the deep sky is carried along with: more than any mote,
 * because it lies further off than all of them. At 1 it would be painted on
 * the screen; at 0.85 it slides past at a seventh of the board's rate.
 */
const CAMERA_CARRY_SHARE = 0.85;
const FULL_TURN = Math.PI * 2;

/** A galaxy or a nebula, adrift: where it is, how big and which way it lies, and how far through its life it has come. */
export interface DeepSkyObject {
  readonly kind: 'nebula' | 'galaxy';
  readonly position: Vector2;
  readonly radiusMeters: number;
  /** Radians the long way of it lies at, and how much the short way is squashed against it. */
  readonly turn: number;
  readonly squash: number;
  /** Which of the deep sky's colours it is painted in. */
  readonly tint: number;
  readonly drift: Vector2;
  readonly ageSeconds: number;
}

export interface DeepSky {
  readonly seed: number;
  /** The field they are placed over: what the camera shows, widened. */
  readonly field: DustWindow;
  readonly objects: readonly DeepSkyObject[];
  /** How many lives each of them has already had: what its next placing is drawn from. */
  readonly lives: readonly number[];
}

/** How brightly a far thing burns just now: nothing at either end of its life, most in the middle. */
export function brightnessOf(object: DeepSkyObject): number {
  const share = object.ageSeconds / LIFE_SECONDS;
  return share < SWELL_SHARE
    ? smooth(share / SWELL_SHARE)
    : smooth((1 - share) / (1 - SWELL_SHARE));
}

export function createDeepSky(seed: number, visible: DustWindow): DeepSky {
  const field = widened(visible);
  const objects: DeepSkyObject[] = [];
  const lives: number[] = [];
  for (let index = 0; index < DEEP_SKY_COUNT; index += 1) {
    objects.push(placed(seed, index, 0, field, (index / DEEP_SKY_COUNT) * LIFE_SECONDS));
    lives.push(0);
  }
  return { seed, field, objects, lives };
}

/**
 * The deep sky a moment later. Its things drift a little by themselves and
 * are carried most of the way along with a pan — they lie further off than
 * the dust, so they slide past slower than any of it. One that has lived
 * out its life is replaced by another, elsewhere in the field: they are
 * never seen to appear, since each comes up out of nothing and goes back.
 */
export function advanceDeepSky(sky: DeepSky, dt: number, visible: DustWindow): DeepSky {
  const field = widened(visible);
  const [pannedX, pannedY] = [field.min.x - sky.field.min.x, field.min.y - sky.field.min.y];
  const objects: DeepSkyObject[] = [];
  const lives: number[] = [];
  sky.objects.forEach((object, index) => {
    const ageSeconds = object.ageSeconds + dt;
    if (ageSeconds >= LIFE_SECONDS) {
      const life = sky.lives[index] + 1;
      objects.push(placed(sky.seed, index, life, field, ageSeconds - LIFE_SECONDS));
      lives.push(life);
      return;
    }
    objects.push({
      ...object,
      ageSeconds,
      position: {
        x: object.position.x + object.drift.x * dt + pannedX * CAMERA_CARRY_SHARE,
        y: object.position.y + object.drift.y * dt + pannedY * CAMERA_CARRY_SHARE,
      },
    });
    lives.push(sky.lives[index]);
  });
  return { seed: sky.seed, field, objects, lives };
}

/** A new far thing, drawn from the world's seed and the life it is: the same world shows the same sky. */
function placed(
  seed: number,
  index: number,
  life: number,
  field: DustWindow,
  ageSeconds: number
): DeepSkyObject {
  const random = createRandom(`${seed}/sky/${index}/${life}`);
  const heading = random.next() * FULL_TURN;
  return {
    kind: random.chance(0.5) ? 'nebula' : 'galaxy',
    position: {
      x: field.min.x + random.next() * (field.max.x - field.min.x),
      y: field.min.y + random.next() * (field.max.y - field.min.y),
    },
    radiusMeters: MIN_RADIUS_METERS + random.next() * (MAX_RADIUS_METERS - MIN_RADIUS_METERS),
    turn: random.next() * FULL_TURN,
    squash: 0.35 + random.next() * 0.4,
    tint: random.next(),
    drift: {
      x: Math.cos(heading) * DRIFT_METERS_PER_SECOND,
      y: Math.sin(heading) * DRIFT_METERS_PER_SECOND,
    },
    ageSeconds,
  };
}

function widened(visible: DustWindow): DustWindow {
  const grownX = ((visible.max.x - visible.min.x) * (FIELD_FACTOR - 1)) / 2;
  const grownY = ((visible.max.y - visible.min.y) * (FIELD_FACTOR - 1)) / 2;
  return {
    min: { x: visible.min.x - grownX, y: visible.min.y - grownY },
    max: { x: visible.max.x + grownX, y: visible.max.y + grownY },
  };
}

/** Smoothstep, so nothing comes up or goes out with a corner in it. */
function smooth(share: number): number {
  const held = Math.min(1, Math.max(0, share));
  return held * held * (3 - 2 * held);
}
