import { describe, expect, it } from 'vitest';

import { advanceParticles, createParticleField, PARTICLE_COUNT } from './particles';

const WINDOW = { min: { x: -30, y: 40 }, max: { x: -5, y: 54 } };

describe('particle field', () => {
  it('carries every particle along the pull and wraps it into the window', () => {
    let field = createParticleField(2, WINDOW);
    const before = field.map(particle => particle.position.y);

    for (let tick = 0; tick < 60; tick += 1) {
      field = advanceParticles(field, { x: 0, y: -1 }, 1 / 60, WINDOW);
    }

    expect(field).toHaveLength(PARTICLE_COUNT);
    field.forEach((particle, index) => {
      expect(particle.position.y).not.toBe(before[index]);
      expect(particle.position.y).toBeGreaterThanOrEqual(WINDOW.min.y);
      expect(particle.position.y).toBeLessThanOrEqual(WINDOW.max.y);
    });
  });

  it('follows the window wherever the camera takes it: the same motes serve the whole endless course', () => {
    const field = createParticleField(2, WINDOW);
    const elsewhere = { min: { x: 500, y: -90 }, max: { x: 525, y: -76 } };

    const moved = advanceParticles(field, { x: 0, y: 0 }, 1 / 60, elsewhere);

    for (const particle of moved) {
      expect(particle.position.x).toBeGreaterThanOrEqual(elsewhere.min.x);
      expect(particle.position.x).toBeLessThanOrEqual(elsewhere.max.x);
    }
  });

  it('leaves the dust still under no pull — the moment a reversal passes through', () => {
    const field = createParticleField(3, WINDOW);

    expect(advanceParticles(field, { x: 0, y: 0 }, 1, WINDOW)).toEqual(field);
  });
});
