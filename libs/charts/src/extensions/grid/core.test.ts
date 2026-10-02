import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';
import { describe, expect, it } from 'vitest';

import { mountLineChart } from '../../testing/line-chart';
import { ticks } from '../ticks/core';
import { linearTicks } from '../ticks/linear-ticks';
import { gridCore } from './core';

function gridAt(devicePixelRatio: number) {
  const { chart } = mountLineChart([ticks({ x: linearTicks() }), gridCore()], {
    size: { width: 1000 * devicePixelRatio, height: 500 * devicePixelRatio, devicePixelRatio },
  });
  const frame = chart.prepareFrame(0);
  assert(!isNil(frame), 'the chart has something to draw');
  return { frame, grid: chart.grid.gridOf(frame), xTicks: chart.ticks.xTicks(frame) };
}

describe('grid', () => {
  it('draws one line per tick inside the plot, spanning it', () => {
    const { frame, grid, xTicks } = gridAt(1);

    const vertical = grid.lines.filter(line => line.height === frame.plot.height);
    const horizontal = grid.lines.filter(line => line.width === frame.plot.width);

    expect(vertical.length).toBeGreaterThan(1);
    expect(vertical.length).toBeLessThanOrEqual(xTicks.length);
    expect(horizontal.length).toBeGreaterThan(1);
    expect(vertical.every(line => line.top === frame.plot.top)).toBe(true);
    expect(horizontal.every(line => line.left === frame.plot.left)).toBe(true);
  });

  it('keeps every line on whole device pixels', () => {
    const { grid } = gridAt(1.5);

    for (const line of grid.lines) {
      expect(Number.isInteger(line.left)).toBe(true);
      expect(Number.isInteger(line.top)).toBe(true);
    }
  });

  it('carries by opacity the weight a line loses by not being thinner than a pixel', () => {
    expect(gridAt(1).grid.opacity).toBe(0.5);
    expect(gridAt(2).grid.opacity).toBe(1);
  });
});
