import { afterEach, describe, expect, it, vi } from 'vitest';

import { availableBackends } from './backends';

const TEXT = {
  measureWidth: (text: string) => text.length,
  getGlyphMetrics: () => ({ ascent: 8, descent: 0, centerOffset: 4 }),
};

describe('the backends a device can run', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is the 2D canvas alone where the browser has no WebGPU', async () => {
    vi.stubGlobal('navigator', {});

    const backends = await availableBackends({ canvas2d: { text: TEXT } });

    expect(backends.map(backend => backend.id)).toEqual(['canvas2d']);
  });

  it('is the 2D canvas alone, and says why, where WebGPU is there but gives no adapter', async () => {
    vi.stubGlobal('navigator', { gpu: { requestAdapter: async () => null } });
    const reasons: unknown[] = [];

    const backends = await availableBackends({
      canvas2d: { text: TEXT },
      onFallback: error => reasons.push(error),
    });

    expect(backends.map(backend => backend.id)).toEqual(['canvas2d']);
    expect(reasons).toHaveLength(1);
  });
});

describe('the universal marks on a device with no WebGPU at all', () => {
  it('can be imported: nothing touches the GPU until a GPU backend draws', async () => {
    const { lineStyle } = await import('./marks/lineStyle');
    const { candleStyle } = await import('./marks/candleStyle');
    const { grid } = await import('./extensions/grid');

    expect(lineStyle().shape).toBe('point');
    expect(candleStyle().shape).toBe('candle');
    expect(grid().id).toBe('grid');
  });
});
