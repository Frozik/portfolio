import { describe, expect, it } from 'vitest';

import { computeCrosshair } from './crosshair';
import type { IChartFrameLayout } from './frame-layout';

const SECONDS_PER_DAY = 86_400;
const JULY_FIRST_2026 = 1_782_864_000;

function createLayout(dpr: number): IChartFrameLayout {
  return {
    timeStart: JULY_FIRST_2026,
    timeEnd: JULY_FIRST_2026 + 10 * SECONDS_PER_DAY,
    valueMin: 80,
    valueMax: 120,
    canvasWidth: 1000 * dpr,
    canvasHeight: 400 * dpr,
    dpr,
    plotLeft: 10 * dpr,
    plotTop: 10 * dpr,
    plotWidth: 980 * dpr,
    plotHeight: 380 * dpr,
    plotRight: 990 * dpr,
    plotBottom: 390 * dpr,
    xTicks: [],
    yTicks: [],
  };
}

describe('computeCrosshair', () => {
  it('is absent while the pointer is away from the chart', () => {
    expect(computeCrosshair(createLayout(1), undefined)).toBeUndefined();
  });

  it.each([
    ['left of', { x: 5, y: 200 }],
    ['right of', { x: 995, y: 200 }],
    ['above', { x: 500, y: 5 }],
    ['below', { x: 500, y: 395 }],
  ])('is absent while the pointer is %s the plot', (_side, pointer) => {
    expect(computeCrosshair(createLayout(1), pointer)).toBeUndefined();
  });

  it('puts one-pixel lines on the device pixel under the pointer', () => {
    const crosshair = computeCrosshair(createLayout(1), { x: 500.7, y: 200.2 });

    expect(crosshair).toMatchObject({ lineLeft: 500, lineTop: 200, thickness: 1 });
  });

  it('thickens the lines three times for ten pixels to each side of the crossing', () => {
    const crosshair = computeCrosshair(createLayout(1), { x: 500, y: 200 });

    expect(crosshair).toMatchObject({ centerThickness: 3, centerArmLength: 10 });
  });

  it('scales every measure with the display density', () => {
    const crosshair = computeCrosshair(createLayout(2), { x: 500, y: 200 });

    expect(crosshair).toMatchObject({
      lineLeft: 1000,
      lineTop: 400,
      thickness: 2,
      centerThickness: 6,
      centerArmLength: 20,
    });
  });

  it('names the time and the value at the centre of its lines', () => {
    const crosshair = computeCrosshair(createLayout(1), { x: 500, y: 100 });

    expect(crosshair?.timeLabel).toBe('6 Jul 00:07');
    expect(crosshair?.valueLabel).toBe('110.0');
  });
});
