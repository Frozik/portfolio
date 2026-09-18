import type { Vector2 } from '@frozik/utils/math/vector2';

import { createRandom } from '../../domain/generator/random';

/** Faint dust drifting the way gravity pulls, so the field itself shows where down is. */
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
 * same motes serve wherever the player looks. A window of another size —
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
  const placed = (particle: Particle): Vector2 =>
    isResized
      ? {
          x: window.min.x + (particle.position.x - before.min.x) * stretchX,
          y: window.min.y + (particle.position.y - before.min.y) * stretchY,
        }
      : particle.position;
  return {
    window,
    particles: field.particles.map(particle => {
      const position = placed(particle);
      return {
        ...particle,
        position: {
          x: wrap(position.x + gravity.x * DRIFT_SPEED_METERS_PER_SECOND * dt, window.min.x, spanX),
          y: wrap(position.y + gravity.y * DRIFT_SPEED_METERS_PER_SECOND * dt, window.min.y, spanY),
        },
      };
    }),
  };
}

function wrap(value: number, min: number, span: number): number {
  return min + ((((value - min) % span) + span) % span);
}
