import { describe, expect, it } from 'vitest';

import { buildDustMesh } from './frame-geometry';
import { MESH_COLOR_OFFSET_BYTES, MESH_VERTEX_STRIDE_BYTES } from './mesh-writer';
import { createParticleField } from './particles';

const WINDOW = { min: { x: -30, y: 40 }, max: { x: -5, y: 54 } };
const ALPHA_CHANNEL = 3;
/** Every mote is one quad: two triangles, six vertices, in the order the field holds them. */
const VERTICES_PER_MOTE = 6;

describe('the dust as it is drawn', () => {
  it('burns the far motes fainter than the near ones, so size and light tell one distance', () => {
    const field = createParticleField(9, WINDOW);

    const { vertexData } = buildDustMesh(field);
    const view = new DataView(vertexData);
    const lit = field.particles.map((particle, index) => ({
      radius: particle.radius,
      alpha: view.getUint8(
        index * VERTICES_PER_MOTE * MESH_VERTEX_STRIDE_BYTES +
          MESH_COLOR_OFFSET_BYTES +
          ALPHA_CHANNEL
      ),
    }));
    const byRadius = [...lit].sort((a, b) => a.radius - b.radius);

    expect(byRadius[0].alpha).toBeLessThan(byRadius[byRadius.length - 1].alpha);
    // Nothing goes out altogether, and nothing outshines the light the dust is given.
    expect(Math.min(...lit.map(mote => mote.alpha))).toBeGreaterThan(30);
    expect(Math.max(...lit.map(mote => mote.alpha))).toBeLessThanOrEqual(90);
    // The light follows the size the whole way down, never in steps of its own.
    byRadius.forEach((mote, index) => {
      if (index > 0) {
        expect(mote.alpha).toBeGreaterThanOrEqual(byRadius[index - 1].alpha);
      }
    });
  });
});
