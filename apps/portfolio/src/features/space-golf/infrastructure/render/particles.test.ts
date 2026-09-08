import { describe, expect, it } from 'vitest';

import {
  advanceParticles,
  createParticleField,
  DRIFT_TURN_SECONDS,
  PARTICLE_COUNT,
} from './particles';

const WIDTH = 9;
const HEIGHT = 16;

describe('particle field', () => {
  it('turns its drift towards the new gravity over half a second, not at once', () => {
    let field = createParticleField(1, WIDTH, HEIGHT);
    expect(field.drift).toEqual({ x: 0, y: -1 });

    field = advanceParticles(field, { x: 1, y: 0 }, DRIFT_TURN_SECONDS / 4, WIDTH, HEIGHT);
    expect(field.drift.x).toBeCloseTo(Math.SQRT1_2, 3);
    expect(field.drift.y).toBeCloseTo(-Math.SQRT1_2, 3);

    field = advanceParticles(field, { x: 1, y: 0 }, DRIFT_TURN_SECONDS, WIDTH, HEIGHT);
    expect(field.drift.x).toBeCloseTo(1, 6);
  });

  it('carries every particle along the drift and wraps it around the board', () => {
    let field = createParticleField(2, WIDTH, HEIGHT);
    const before = field.particles.map(p => p.position.y);

    for (let tick = 0; tick < 60; tick += 1) {
      field = advanceParticles(field, { x: 0, y: -1 }, 1 / 60, WIDTH, HEIGHT);
    }

    expect(field.particles).toHaveLength(PARTICLE_COUNT);
    field.particles.forEach((particle, index) => {
      expect(particle.position.y).not.toBe(before[index]);
      expect(particle.position.y).toBeGreaterThanOrEqual(-2);
      expect(particle.position.y).toBeLessThanOrEqual(HEIGHT + 2);
    });
  });
});
