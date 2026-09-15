import { describe, expect, it } from 'vitest';

import { advanceParticles, createParticleField, PARTICLE_COUNT } from './particles';

const WIDTH = 9;
const HEIGHT = 16;

describe('particle field', () => {
  it('carries every particle along the pull and wraps it around the board', () => {
    let field = createParticleField(2, WIDTH, HEIGHT);
    const before = field.map(p => p.position.y);

    for (let tick = 0; tick < 60; tick += 1) {
      field = advanceParticles(field, { x: 0, y: -1 }, 1 / 60, WIDTH, HEIGHT);
    }

    expect(field).toHaveLength(PARTICLE_COUNT);
    field.forEach((particle, index) => {
      expect(particle.position.y).not.toBe(before[index]);
      expect(particle.position.y).toBeGreaterThanOrEqual(-2);
      expect(particle.position.y).toBeLessThanOrEqual(HEIGHT + 2);
    });
  });

  it('leaves the dust still under no pull — the moment a reversal passes through', () => {
    const field = createParticleField(3, WIDTH, HEIGHT);

    expect(advanceParticles(field, { x: 0, y: 0 }, 1, WIDTH, HEIGHT)).toEqual(field);
  });
});
