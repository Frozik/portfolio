import { describe, expect, it } from 'vitest';

import { advanceParticles, createParticleField, PARTICLE_COUNT } from './particles';

const WINDOW = { min: { x: -30, y: 40 }, max: { x: -5, y: 54 } };

describe('particle field', () => {
  it('carries every particle along the pull and wraps it into the window', () => {
    let field = createParticleField(2, WINDOW);
    const before = field.particles.map(particle => particle.position.y);

    for (let tick = 0; tick < 60; tick += 1) {
      field = advanceParticles(field, { x: 0, y: -1 }, 1 / 60, WINDOW);
    }

    expect(field.particles).toHaveLength(PARTICLE_COUNT);
    field.particles.forEach((particle, index) => {
      expect(particle.position.y).not.toBe(before[index]);
      expect(particle.position.y).toBeGreaterThanOrEqual(WINDOW.min.y);
      expect(particle.position.y).toBeLessThanOrEqual(WINDOW.max.y);
    });
  });

  it('drifts the small motes slower than the big ones: the field moves in layers, not as one sheet', () => {
    const field = createParticleField(5, WINDOW);
    const sorted = [...field.particles].sort((a, b) => a.radius - b.radius);
    const [smallest] = sorted;
    const largest = sorted[sorted.length - 1];
    const startedAt = new Map(field.particles.map(particle => [particle, particle.position.y]));

    // Straight up, a tenth of a second: short enough that nothing wraps round the window.
    const moved = advanceParticles(field, { x: 0, y: 1 }, 0.1, WINDOW);
    const wentBy = (index: number): number =>
      moved.particles[index].position.y - (startedAt.get(field.particles[index]) ?? 0);

    const small = wentBy(field.particles.indexOf(smallest));
    const large = wentBy(field.particles.indexOf(largest));
    expect(small).toBeGreaterThan(0);
    expect(small).toBeLessThan(large / 2);
    field.particles.forEach((_, index) => {
      const share = wentBy(index) / large;
      expect(share).toBeGreaterThanOrEqual(0.2);
      expect(share).toBeLessThanOrEqual(1.0001);
    });
  });

  it('carries the far motes along with a panning camera and leaves the near ones on the board', () => {
    const field = createParticleField(5, WINDOW);
    const sorted = [...field.particles].sort((a, b) => a.radius - b.radius);
    const [smallest] = sorted;
    const largest = sorted[sorted.length - 1];
    const panned = {
      min: { x: WINDOW.min.x + 1, y: WINDOW.min.y },
      max: { x: WINDOW.max.x + 1, y: WINDOW.max.y },
    };

    // A pan of a metre to the right, with no pull at all: only the parallax
    // moves anything, and a mote that wraps round the window went the same way.
    const moved = advanceParticles(field, { x: 0, y: 0 }, 1 / 60, panned);
    const span = WINDOW.max.x - WINDOW.min.x;
    const wentBy = (particle: (typeof field.particles)[number]): number => {
      const gone =
        moved.particles[field.particles.indexOf(particle)].position.x - particle.position.x;
      return (((gone % span) + span + span / 2) % span) - span / 2;
    };

    expect(wentBy(largest)).toBeCloseTo(0);
    expect(wentBy(smallest)).toBeGreaterThan(0.4);
    expect(wentBy(smallest)).toBeLessThan(1);
  });

  it('follows the window wherever the camera takes it: the same motes serve the whole endless course', () => {
    const field = createParticleField(2, WINDOW);
    const elsewhere = { min: { x: 500, y: -90 }, max: { x: 525, y: -76 } };

    const moved = advanceParticles(field, { x: 0, y: 0 }, 1 / 60, elsewhere);

    for (const particle of moved.particles) {
      expect(particle.position.x).toBeGreaterThanOrEqual(elsewhere.min.x);
      expect(particle.position.x).toBeLessThanOrEqual(elsewhere.max.x);
    }
  });

  it('leaves the dust still under no pull — the moment a reversal passes through', () => {
    const field = createParticleField(3, WINDOW);

    expect(advanceParticles(field, { x: 0, y: 0 }, 1, WINDOW)).toEqual(field);
  });

  it('stays spread over the whole window when the view zooms out or in, instead of keeping to the patch it filled before', () => {
    const CELLS = 3;
    const spread = (window: typeof WINDOW, positions: readonly { x: number; y: number }[]) => {
      const counts = Array.from({ length: CELLS * CELLS }, () => 0);
      for (const { x, y } of positions) {
        const column = Math.min(
          CELLS - 1,
          Math.floor(((x - window.min.x) / (window.max.x - window.min.x)) * CELLS)
        );
        const row = Math.min(
          CELLS - 1,
          Math.floor(((y - window.min.y) / (window.max.y - window.min.y)) * CELLS)
        );
        counts[row * CELLS + column] += 1;
      }
      return counts;
    };
    const zoomedOut = { min: { x: -55, y: 26 }, max: { x: 20, y: 68 } };
    const fairShare = PARTICLE_COUNT / (CELLS * CELLS);

    const wide = advanceParticles(
      createParticleField(2, WINDOW),
      { x: 0, y: -1 },
      1 / 60,
      zoomedOut
    );
    const narrowAgain = advanceParticles(wide, { x: 0, y: -1 }, 1 / 60, WINDOW);

    for (const count of [
      ...spread(
        zoomedOut,
        wide.particles.map(particle => particle.position)
      ),
      ...spread(
        WINDOW,
        narrowAgain.particles.map(particle => particle.position)
      ),
    ]) {
      expect(count).toBeGreaterThan(fairShare / 3);
    }
  });
});
