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
  it('reverses its drift through a stop over a second — the fall dies out and the rise picks up, no swing to the side', () => {
    let field = createParticleField(1, WIDTH, HEIGHT);
    expect(field.drift).toEqual({ x: 0, y: -1 });

    field = advanceParticles(field, { x: 0, y: 1 }, DRIFT_TURN_SECONDS / 2, WIDTH, HEIGHT);
    expect(field.drift.x).toBe(0);
    expect(field.drift.y).toBeCloseTo(0, 6);

    field = advanceParticles(field, { x: 0, y: 1 }, DRIFT_TURN_SECONDS / 4, WIDTH, HEIGHT);
    expect(field.drift.x).toBe(0);
    expect(field.drift.y).toBeCloseTo(0.5, 6);

    field = advanceParticles(field, { x: 0, y: 1 }, DRIFT_TURN_SECONDS, WIDTH, HEIGHT);
    expect(field.drift).toEqual({ x: 0, y: 1 });
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
