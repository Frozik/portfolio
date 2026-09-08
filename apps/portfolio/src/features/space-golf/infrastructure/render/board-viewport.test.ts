import { describe, expect, it } from 'vitest';

import { boardToPixel, fitBoard, pixelToBoard } from './board-viewport';

const BOARD = { width: 9, height: 16 };

describe('fitBoard', () => {
  it('letterboxes a portrait board inside a landscape viewport, centred', () => {
    const viewport = fitBoard({ width: 1600, height: 800 }, BOARD);

    expect(viewport.scale).toBeCloseTo((800 / 16) * 0.97);
    expect(boardToPixel(viewport, { x: 4.5, y: 8 })).toEqual({ x: 800, y: 400 });
  });

  it('maps pixels back to board metres, y up', () => {
    const viewport = fitBoard({ width: 900, height: 1600 }, BOARD);
    const corner = boardToPixel(viewport, { x: 0, y: 0 });

    expect(pixelToBoard(viewport, corner)).toEqual({ x: 0, y: 0 });
    expect(pixelToBoard(viewport, { x: corner.x, y: corner.y - viewport.scale }).y).toBeCloseTo(1);
  });
});
