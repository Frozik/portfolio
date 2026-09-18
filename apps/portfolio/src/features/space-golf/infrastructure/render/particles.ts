import type { Vector2 } from '@frozik/utils/math/vector2';

import { createRandom } from '../../domain/generator/random';

/** Faint dust drifting the way gravity pulls, so the field itself shows where down is. */
interface Particle {
  readonly position: Vector2;
  readonly radius: number;
}

export type ParticleField = readonly Particle[];

/** Enough for a desktop's view at the one scale to look dusty, and not too many for a phone. */
export const PARTICLE_COUNT = 200;
const MIN_RADIUS_METERS = 0.015;
const MAX_RADIUS_METERS = 0.04;
const DRIFT_SPEED_METERS_PER_SECOND = 0.35;

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
  return particles;
}

/**
 * The dust a moment later: drifted along gravity and wrapped into the
 * window, which travels with the camera — the course has no edge, so the
 * same motes serve wherever the player looks.
 */
export function advanceParticles(
  field: ParticleField,
  gravity: Vector2,
  dt: number,
  window: DustWindow
): ParticleField {
  const spanX = window.max.x - window.min.x;
  const spanY = window.max.y - window.min.y;
  return field.map(particle => ({
    ...particle,
    position: {
      x: wrap(
        particle.position.x + gravity.x * DRIFT_SPEED_METERS_PER_SECOND * dt,
        window.min.x,
        spanX
      ),
      y: wrap(
        particle.position.y + gravity.y * DRIFT_SPEED_METERS_PER_SECOND * dt,
        window.min.y,
        spanY
      ),
    },
  }));
}

function wrap(value: number, min: number, span: number): number {
  return min + ((((value - min) % span) + span) % span);
}
