import { describe, expect, it } from 'vitest';

import { mountLineChart } from '../../testing/line-chart';
import { ticks } from '../ticks/core';
import { linearTicks } from '../ticks/linear-ticks';
import { annotationsCore } from './core';

function scene() {
  return mountLineChart([
    ticks({ x: linearTicks() }),
    annotationsCore<number>({ levels: [{ value: 20 }], events: [{ x: 50, label: 'E' }] }),
  ]).chart;
}

describe('annotations', () => {
  it('start with the levels and events they were given', () => {
    const chart = scene();

    expect(chart.annotations.levels).toEqual([{ value: 20 }]);
    expect(chart.annotations.events).toEqual([{ x: 50, label: 'E' }]);
  });

  it('are replaced on a live chart, and say so to whatever draws them', () => {
    const chart = scene();
    const before = chart.annotations.revision;

    chart.annotations.setLevels([{ value: 25, label: 'limit' }]);
    chart.annotations.setEvents([]);

    expect(chart.annotations.levels).toEqual([{ value: 25, label: 'limit' }]);
    expect(chart.annotations.events).toEqual([]);
    expect(chart.annotations.revision).toBe(before + 2);
  });

  it('take no part in fitting the scale', () => {
    const chart = scene();
    chart.annotations.setLevels([{ value: 1_000_000 }]);

    chart.prepareFrame(0);

    expect(chart.viewport.scale('main').current).toEqual({ start: 0, end: 1 });
  });
});
