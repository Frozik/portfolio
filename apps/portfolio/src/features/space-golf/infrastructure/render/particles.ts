import type { Vector2 } from '@frozik/utils/math/vector2';

import { createRandom } from '../../domain/generator/random';

/** Faint dust drifting the way gravity pulls, so the field itself shows where down is. */
interface Particle {
  readonly position: Vector2;
  readonly radius: number;
}

export type ParticleField = readonly Particle[];

/** Ninety on the 9 × 16 m board; scaled with the board's area. */
export const PARTICLE_COUNT = 200;
const MIN_RADIUS_METERS = 0.015;
const MAX_RADIUS_METERS = 0.04;
/** Dust spills this far past the board on every side and wraps around there. */
const PARTICLE_MARGIN_METERS = 2;
const DRIFT_SPEED_METERS_PER_SECOND = 0.35;

export function createParticleField(seed: number, width: number, height: number): ParticleField {
  const random = createRandom(seed);
  const particles: Particle[] = [];
  for (let index = 0; index < PARTICLE_COUNT; index += 1) {
    particles.push({
      position: {
        x: -PARTICLE_MARGIN_METERS + random.next() * (width + 2 * PARTICLE_MARGIN_METERS),
        y: -PARTICLE_MARGIN_METERS + random.next() * (height + 2 * PARTICLE_MARGIN_METERS),
      },
      radius: MIN_RADIUS_METERS + random.next() * (MAX_RADIUS_METERS - MIN_RADIUS_METERS),
    });
  }
  return particles;
}

export function advanceParticles(
  field: ParticleField,
  gravity: Vector2,
  dt: number,
  width: number,
  height: number
): ParticleField {
  const minX = -PARTICLE_MARGIN_METERS;
  const minY = -PARTICLE_MARGIN_METERS;
  const spanX = width + 2 * PARTICLE_MARGIN_METERS;
  const spanY = height + 2 * PARTICLE_MARGIN_METERS;
  return field.map(particle => ({
    ...particle,
    position: {
      x: wrap(particle.position.x + gravity.x * DRIFT_SPEED_METERS_PER_SECOND * dt, minX, spanX),
      y: wrap(particle.position.y + gravity.y * DRIFT_SPEED_METERS_PER_SECOND * dt, minY, spanY),
    },
  }));
}

function wrap(value: number, min: number, span: number): number {
  return min + ((((value - min) % span) + span) % span);
}
