import { describe, expect, it } from 'vitest';

import { boardToPixel, pixelToBoard, viewportOf } from './board-viewport';

describe('viewportOf', () => {
  it("puts the camera's centre in the middle of the canvas at the given scale, y up", () => {
    const viewport = viewportOf({ x: 4, y: 10 }, 64, { width: 390, height: 844 });

    expect(boardToPixel(viewport, { x: 4, y: 10 })).toEqual({ x: 195, y: 422 });
    expect(boardToPixel(viewport, { x: 5, y: 11 })).toEqual({ x: 259, y: 358 });
  });

  it('maps pixels back to board metres', () => {
    const viewport = viewportOf({ x: 4, y: 10 }, 64, { width: 390, height: 844 });

    expect(pixelToBoard(viewport, { x: 195, y: 422 })).toEqual({ x: 4, y: 10 });
    expect(pixelToBoard(viewport, { x: 195, y: 358 }).y).toBeCloseTo(11);
  });
});
