import type { Vector2 } from '@frozik/utils/math/vector2';

import { createRandom } from '../../domain/generator/random';

/** Faint dust drifting the way gravity pulls, so the field itself shows where down is. */
interface Particle {
  readonly position: Vector2;
  readonly radius: number;
}

export interface ParticleField {
  readonly particles: readonly Particle[];
  /** The direction the dust drifts in; it eases towards gravity rather than snapping. */
  readonly drift: Vector2;
}

export const PARTICLE_COUNT = 90;
const MIN_RADIUS_METERS = 0.015;
const MAX_RADIUS_METERS = 0.04;
/** Dust spills this far past the board on every side and wraps around there. */
const PARTICLE_MARGIN_METERS = 2;
const DRIFT_SPEED_METERS_PER_SECOND = 0.35;
/** The dust takes about this long to turn towards a new gravity — the lag seen in the original. */
export const DRIFT_TURN_SECONDS = 0.5;
const HALF_TURN = Math.PI;

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
  return { particles, drift: { x: 0, y: -1 } };
}

/**
 * Moves the dust for `dt` seconds: the drift direction turns towards `down`
 * at the pace of a half turn per {@link DRIFT_TURN_SECONDS}, and every
 * particle slides along it, wrapping around the margin box.
 */
export function advanceParticles(
  field: ParticleField,
  down: Vector2,
  dt: number,
  width: number,
  height: number
): ParticleField {
  const drift = turnTowards(field.drift, down, (HALF_TURN / DRIFT_TURN_SECONDS) * dt);
  const minX = -PARTICLE_MARGIN_METERS;
  const minY = -PARTICLE_MARGIN_METERS;
  const spanX = width + 2 * PARTICLE_MARGIN_METERS;
  const spanY = height + 2 * PARTICLE_MARGIN_METERS;
  const particles = field.particles.map(particle => ({
    ...particle,
    position: {
      x: wrap(particle.position.x + drift.x * DRIFT_SPEED_METERS_PER_SECOND * dt, minX, spanX),
      y: wrap(particle.position.y + drift.y * DRIFT_SPEED_METERS_PER_SECOND * dt, minY, spanY),
    },
  }));
  return { particles, drift };
}

function wrap(value: number, min: number, span: number): number {
  return min + ((((value - min) % span) + span) % span);
}

/** Rotates the unit vector `from` towards `to` by at most `maxRadians`. */
function turnTowards(from: Vector2, to: Vector2, maxRadians: number): Vector2 {
  const current = Math.atan2(from.y, from.x);
  const target = Math.atan2(to.y, to.x);
  let delta = target - current;
  while (delta > Math.PI) {
    delta -= 2 * Math.PI;
  }
  while (delta < -Math.PI) {
    delta += 2 * Math.PI;
  }
  const step = Math.max(-maxRadians, Math.min(maxRadians, delta));
  const angle = current + step;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}
