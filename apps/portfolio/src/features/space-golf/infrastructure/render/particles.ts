import type { Vector2 } from '@frozik/utils/math/vector2';

import { createRandom } from '../../domain/generator/random';

/**
 * Faint dust drifting the way gravity pulls, so the field itself shows
 * where down is. A mote's size is its distance: the big ones are close and
 * go with the pull at full speed, the small ones are far off and lag.
 */
interface Particle {
  readonly position: Vector2;
  readonly radius: number;
}

/** The motes and the window they are spread over. */
export interface ParticleField {
  readonly window: DustWindow;
  readonly particles: readonly Particle[];
}

/** Enough for a desktop's view at the one scale to look dusty, and not too many for a phone. */
export const PARTICLE_COUNT = 200;
const MIN_RADIUS_METERS = 0.015;
const MAX_RADIUS_METERS = 0.04;
const DRIFT_SPEED_METERS_PER_SECOND = 0.35;
/** The share of that speed the smallest mote drifts at: the farthest of them all but still adrift. */
const FARTHEST_DRIFT_SHARE = 0.25;
/**
 * How much of a pan the farthest mote is carried along with. At 0 the dust
 * lies on the board and slides past with it; at 1 it would be painted on
 * the screen and never move at all. In between it lies behind the board,
 * where the stars are.
 */
const CAMERA_CARRY_SHARE = 0.6;
/** Windows whose spans differ by less than this share are the same size: a pan, not a zoom. */
const SAME_SPAN_TOLERANCE = 1e-9;

/** The window the dust lives in: what the camera shows, and a little more so none pops in at the edge. */
export interface DustWindow {
  readonly min: Vector2;
  readonly max: Vector2;
}

export function createParticleField(seed: number, window: DustWindow): ParticleField {
  const random = createRandom(seed);
  const particles: Particle[] = [];
  for (let index = 0; index < PARTICLE_COUNT; index += 1) {
    particles.push({
      position: {
        x: window.min.x + random.next() * (window.max.x - window.min.x),
        y: window.min.y + random.next() * (window.max.y - window.min.y),
      },
      radius: MIN_RADIUS_METERS + random.next() * (MAX_RADIUS_METERS - MIN_RADIUS_METERS),
    });
  }
  return { window, particles };
}

/**
 * The dust a moment later: drifted along gravity and wrapped into the
 * window, which travels with the camera — the course has no edge, so the
 * same motes serve wherever the player looks — the far ones lagging behind
 * the near ones as it travels. A window of another size —
 * the view zoomed, a phone turned — has the motes spread over it anew, each
 * keeping its place in the window: left where they were, the motes of a
 * small window stayed a patch in the middle of a large one, and the ones
 * that drifted out of the patch came back in as blocks along its far side.
 */
export function advanceParticles(
  field: ParticleField,
  gravity: Vector2,
  dt: number,
  window: DustWindow
): ParticleField {
  const before = field.window;
  const spanX = window.max.x - window.min.x;
  const spanY = window.max.y - window.min.y;
  const stretchX = spanX / (before.max.x - before.min.x);
  const stretchY = spanY / (before.max.y - before.min.y);
  const isResized =
    Math.abs(stretchX - 1) > SAME_SPAN_TOLERANCE || Math.abs(stretchY - 1) > SAME_SPAN_TOLERANCE;
  // A pan carries the far motes part of the way with it, so they slide past
  // slower than the board does: the depth their size stands for, seen.
  const [pannedX, pannedY] = [window.min.x - before.min.x, window.min.y - before.min.y];
  const placed = (particle: Particle): Vector2 => {
    if (isResized) {
      return {
        x: window.min.x + (particle.position.x - before.min.x) * stretchX,
        y: window.min.y + (particle.position.y - before.min.y) * stretchY,
      };
    }
    const carried = CAMERA_CARRY_SHARE * (1 - nearnessOf(particle));
    return {
      x: particle.position.x + pannedX * carried,
      y: particle.position.y + pannedY * carried,
    };
  };
  return {
    window,
    particles: field.particles.map(particle => {
      const position = placed(particle);
      const drift = driftSpeedOf(particle) * dt;
      return {
        ...particle,
        position: {
          x: wrap(position.x + gravity.x * drift, window.min.x, spanX),
          y: wrap(position.y + gravity.y * drift, window.min.y, spanY),
        },
      };
    }),
  };
}

/**
 * How fast a mote goes with the pull: the near ones — the big ones — at the
 * full drift, the far ones slower in proportion to their size. A field that
 * moves all of a piece reads as a flat sheet behind the board; one that
 * moves in layers reads as depth, and the turn of gravity sweeps through it.
 */
function driftSpeedOf(particle: Particle): number {
  return (
    DRIFT_SPEED_METERS_PER_SECOND *
    (FARTHEST_DRIFT_SHARE + (1 - FARTHEST_DRIFT_SHARE) * nearnessOf(particle))
  );
}

/**
 * How near a mote is, read off its size: 1 the closest of them, 0 the
 * farthest. Everything about a mote but where it lies follows from this —
 * how fast it goes with the pull, how much of a pan it is carried along
 * with, and how brightly it burns.
 */
export function nearnessOf(particle: { readonly radius: number }): number {
  return (particle.radius - MIN_RADIUS_METERS) / (MAX_RADIUS_METERS - MIN_RADIUS_METERS);
}

function wrap(value: number, min: number, span: number): number {
  return min + ((((value - min) % span) + span) % span);
}
