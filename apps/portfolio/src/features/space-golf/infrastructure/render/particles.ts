import type { Vector2 } from '@frozik/utils/math/vector2';

import { createRandom } from '../../domain/generator/random';

/** Faint dust drifting the way gravity pulls, so the field itself shows where down is. */
interface Particle {
  readonly position: Vector2;
  readonly radius: number;
}

export interface ParticleField {
  readonly particles: readonly Particle[];
  /**
   * The dust's velocity as a share of its full speed, at most a unit vector.
   * It eases towards gravity along a straight line: after a reversal the
   * fall slows to a stop and picks up the other way, never swings round.
   */
  readonly drift: Vector2;
}

export const PARTICLE_COUNT = 90;
const MIN_RADIUS_METERS = 0.015;
const MAX_RADIUS_METERS = 0.04;
/** Dust spills this far past the board on every side and wraps around there. */
const PARTICLE_MARGIN_METERS = 2;
const DRIFT_SPEED_METERS_PER_SECOND = 0.35;
/** The dust takes this long to go from full speed one way to full speed the other — the lag seen in the original. */
export const DRIFT_TURN_SECONDS = 1;
/** Distance between two opposite unit drifts. */
const FULL_REVERSAL = 2;

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
 * Moves the dust for `dt` seconds: the drift moves straight towards `down`
 * at the pace of a full reversal per {@link DRIFT_TURN_SECONDS}, and every
 * particle slides along it, wrapping around the margin box.
 */
export function advanceParticles(
  field: ParticleField,
  down: Vector2,
  dt: number,
  width: number,
  height: number
): ParticleField {
  const drift = moveTowards(field.drift, down, (FULL_REVERSAL / DRIFT_TURN_SECONDS) * dt);
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

/** The vector `from` moved straight towards `to` by at most `maxDistance`. */
function moveTowards(from: Vector2, to: Vector2, maxDistance: number): Vector2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const gap = Math.hypot(dx, dy);
  if (gap <= maxDistance) {
    return to;
  }
  const share = maxDistance / gap;
  return { x: from.x + dx * share, y: from.y + dy * share };
}
