import { describe, expect, it, vi } from 'vitest';

import { createGameUpdateLayer } from './game-update-layer';

const FRAME = { canvasWidth: 900, canvasHeight: 1600, devicePixelRatio: 1 };

describe('game update layer', () => {
  it('advances the game by the seconds between frames and by nothing on the first', () => {
    const advance = vi.fn();
    const layer = createGameUpdateLayer(advance);

    layer.update({ ...FRAME, time: 1 });
    layer.update({ ...FRAME, time: 1.016 });
    layer.update({ ...FRAME, time: 1.05 });

    const seconds = advance.mock.calls.map(([elapsed]) => elapsed as number);
    expect(seconds[0]).toBe(0);
    expect(seconds[1]).toBeCloseTo(0.016);
    expect(seconds[2]).toBeCloseTo(0.034);
  });
});
