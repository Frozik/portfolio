import { describe, expect, it } from 'vitest';

import { boardPixelRect, boardToPixel, fitBoard, pixelToBoard } from './board-viewport';

const BOARD = { width: 9, height: 16 };

describe('fitBoard', () => {
  it('stands the board upright in a portrait viewport, centred, y up', () => {
    const viewport = fitBoard({ width: 900, height: 1600 }, BOARD);

    expect(viewport.scale).toBeCloseTo((900 / 9) * 0.97);
    expect(boardToPixel(viewport, { x: 4.5, y: 8 })).toEqual({ x: 450, y: 800 });
    expect(boardToPixel(viewport, { x: 4.5, y: 16 }).y).toBeLessThan(800);
  });

  it('turns the board a quarter in a landscape viewport so it fills the screen, its top at the left', () => {
    const viewport = fitBoard({ width: 1600, height: 800 }, BOARD);

    expect(viewport.scale).toBeCloseTo((800 / 9) * 0.97);
    expect(boardToPixel(viewport, { x: 4.5, y: 8 }).x).toBeCloseTo(800);
    expect(boardToPixel(viewport, { x: 4.5, y: 8 }).y).toBeCloseTo(400);
    expect(boardToPixel(viewport, { x: 4.5, y: 16 }).x).toBeLessThan(800);
    expect(boardToPixel(viewport, { x: 9, y: 8 }).y).toBeLessThan(400);
    expect(pixelToBoard(viewport, boardToPixel(viewport, { x: 2, y: 13 })).x).toBeCloseTo(2);
    expect(pixelToBoard(viewport, boardToPixel(viewport, { x: 2, y: 13 })).y).toBeCloseTo(13);
  });

  it('maps pixels back to board metres, y up', () => {
    const viewport = fitBoard({ width: 900, height: 1600 }, BOARD);
    const corner = boardToPixel(viewport, { x: 0, y: 0 });

    expect(pixelToBoard(viewport, corner)).toEqual({ x: 0, y: 0 });
    expect(pixelToBoard(viewport, { x: corner.x, y: corner.y - viewport.scale }).y).toBeCloseTo(1);
  });
});

describe('boardPixelRect', () => {
  it('covers the board and nothing beyond it, in whole pixels inside the canvas', () => {
    const canvas = { width: 1600, height: 800 };
    const viewport = fitBoard(canvas, BOARD);

    const rect = boardPixelRect(viewport, BOARD, canvas);

    // Turned a quarter: the board's top is at the left, its right side at the top.
    expect(rect.x).toBe(Math.floor(boardToPixel(viewport, { x: 0, y: 16 }).x));
    expect(rect.y).toBe(Math.floor(boardToPixel(viewport, { x: 9, y: 0 }).y));
    expect(rect.x + rect.width).toBe(Math.ceil(boardToPixel(viewport, { x: 0, y: 0 }).x));
    expect(rect.y + rect.height).toBe(Math.ceil(boardToPixel(viewport, { x: 0, y: 0 }).y));
    expect(rect.x + rect.width).toBeLessThanOrEqual(canvas.width);
    expect(rect.y + rect.height).toBeLessThanOrEqual(canvas.height);
  });
});
