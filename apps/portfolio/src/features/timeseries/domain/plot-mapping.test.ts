import { describe, expect, it } from 'vitest';

import type { IChartFrameLayout } from './frame-layout';
import { pixelXToTime, pixelYToValue, timeToPixelX, valueToPixelY } from './plot-mapping';

const LAYOUT: IChartFrameLayout = {
  timeStart: 1000,
  timeEnd: 2000,
  valueMin: 50,
  valueMax: 150,
  canvasWidth: 800,
  canvasHeight: 400,
  dpr: 1,
  plotLeft: 10,
  plotTop: 10,
  plotWidth: 780,
  plotHeight: 380,
  plotRight: 790,
  plotBottom: 390,
  xTicks: [],
  yTicks: [],
};

describe('plot mapping', () => {
  it('spreads the visible time range over the whole canvas width, as the series shaders do', () => {
    expect(timeToPixelX(LAYOUT, 1000)).toBe(0);
    expect(timeToPixelX(LAYOUT, 1500)).toBe(400);
    expect(timeToPixelX(LAYOUT, 2000)).toBe(800);
  });

  it('spreads the visible value range over the whole canvas height, larger values higher', () => {
    expect(valueToPixelY(LAYOUT, 50)).toBe(400);
    expect(valueToPixelY(LAYOUT, 100)).toBe(200);
    expect(valueToPixelY(LAYOUT, 150)).toBe(0);
  });

  it('reads back the time and value a pixel stands for', () => {
    expect(pixelXToTime(LAYOUT, timeToPixelX(LAYOUT, 1234))).toBeCloseTo(1234);
    expect(pixelYToValue(LAYOUT, valueToPixelY(LAYOUT, 87.5))).toBeCloseTo(87.5);
  });
});
