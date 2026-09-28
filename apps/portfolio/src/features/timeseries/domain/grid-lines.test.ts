import { describe, expect, it } from 'vitest';

import type { IChartFrameLayout } from './frame-layout';
import { computeChartGrid } from './grid-lines';
import type { IAxisTick } from './types';

function createLayout(overrides: {
  readonly dpr?: number;
  readonly xTicks?: readonly IAxisTick[];
  readonly yTicks?: readonly IAxisTick[];
}): IChartFrameLayout {
  const dpr = overrides.dpr ?? 1;
  const plotLeft = 10 * dpr;
  const plotTop = 10 * dpr;
  const plotWidth = 400 * dpr;
  const plotHeight = 200 * dpr;

  return {
    timeStart: 0,
    timeEnd: 100,
    valueMin: 0,
    valueMax: 50,
    canvasWidth: plotWidth + plotLeft * 2,
    canvasHeight: plotHeight + plotTop * 2,
    dpr,
    plotLeft,
    plotTop,
    plotWidth,
    plotHeight,
    plotRight: plotLeft + plotWidth,
    plotBottom: plotTop + plotHeight,
    xTicks: overrides.xTicks ?? [],
    yTicks: overrides.yTicks ?? [],
  };
}

function tick(position: number): IAxisTick {
  return { position, label: String(position) };
}

describe('computeChartGrid', () => {
  it('spans the plot height with a vertical line under every time tick', () => {
    const grid = computeChartGrid(createLayout({ xTicks: [tick(25), tick(50)] }));

    expect(grid.lines).toEqual([
      { left: 105, top: 10, width: 1, height: 200 },
      { left: 210, top: 10, width: 1, height: 200 },
    ]);
  });

  it('spans the plot width with a horizontal line at every value tick, larger values higher', () => {
    const grid = computeChartGrid(createLayout({ yTicks: [tick(10), tick(40)] }));

    expect(grid.lines).toEqual([
      { left: 10, top: 176, width: 400, height: 1 },
      { left: 10, top: 44, width: 400, height: 1 },
    ]);
  });

  it('leaves out the ticks that fall into the margins around the plot', () => {
    const grid = computeChartGrid(
      createLayout({ xTicks: [tick(1), tick(50), tick(99)], yTicks: [tick(1), tick(49)] })
    );

    expect(grid.lines).toEqual([{ left: 210, top: 10, width: 1, height: 200 }]);
  });

  it('starts every line on a device-pixel boundary', () => {
    const grid = computeChartGrid(createLayout({ xTicks: [tick(33.3)], yTicks: [tick(12.7)] }));

    expect(grid.lines.map(line => [line.left, line.top])).toEqual([
      [139, 10],
      [10, 164],
    ]);
  });

  it('draws a full pixel at half opacity where the line would be half a pixel thick', () => {
    const grid = computeChartGrid(createLayout({ dpr: 1, xTicks: [tick(50)] }));

    expect(grid.lines[0].width).toBe(1);
    expect(grid.opacity).toBe(0.5);
  });

  it('draws an opaque one-pixel line on a 2x display', () => {
    const grid = computeChartGrid(createLayout({ dpr: 2, xTicks: [tick(50)] }));

    expect(grid.lines[0].width).toBe(1);
    expect(grid.opacity).toBe(1);
  });

  it('scales the dash length with the display density', () => {
    expect(computeChartGrid(createLayout({ dpr: 1 })).dashLength).toBe(10);
    expect(computeChartGrid(createLayout({ dpr: 2 })).dashLength).toBe(20);
  });
});
