import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';
import { describe, expect, it } from 'vitest';

import { staticData } from '../../data/static-data';
import { mountLineChart } from '../../testing/line-chart';
import { debugBlocksCore } from './core';

/** A point at every whole position from 0 to 100, on a chart a thousand pixels wide. */
const DENSE = staticData<number>({
  shape: 'point',
  points: Array.from({ length: 101 }, (_, index) => ({ x: index, value: index })),
});

function scene(blockSize?: number) {
  const { chart } = mountLineChart(
    [debugBlocksCore(isNil(blockSize) ? {} : { blockSize: () => blockSize })],
    { data: DENSE }
  );
  const frame = chart.prepareFrame(0);
  assert(!isNil(frame), 'the chart has something to draw');
  return { chart, frame };
}

describe('debug blocks', () => {
  it('draws nothing until switched on', () => {
    const { chart, frame } = scene(25);

    expect(chart.debugBlocks.enabled).toBe(false);
    expect(chart.debugBlocks.linesOf(frame)).toEqual([]);
  });

  it('marks where each block of the backend begins', () => {
    const { chart, frame } = scene(25);
    chart.debugBlocks.setEnabled(true);

    const lines = chart.debugBlocks.linesOf(frame);

    expect(lines.map(line => line.left + line.width / 2)).toEqual([250, 500, 750]);
    expect(lines.every(line => line.top === frame.plot.top)).toBe(true);
    expect(lines.every(line => line.height === frame.plot.height)).toBe(true);
  });

  it('marks only the beginning of a run when the backend names no block size', () => {
    const { chart, frame } = scene();
    chart.viewport.jump({ start: -50, end: 50 });
    chart.debugBlocks.setEnabled(true);
    const moved = chart.prepareFrame(16);
    assert(!isNil(moved), 'the chart has something to draw');

    expect(chart.debugBlocks.linesOf(frame)).toEqual([]);
    expect(chart.debugBlocks.linesOf(moved)).toHaveLength(1);
  });

  it('tells painters to draw again when switched', () => {
    const { chart } = scene(25);
    const before = chart.debugBlocks.revision;

    chart.debugBlocks.setEnabled(true);
    chart.debugBlocks.setEnabled(true);

    expect(chart.debugBlocks.revision).toBe(before + 1);
  });
});
