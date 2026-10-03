import { describe, expect, it } from 'vitest';

import { mountLineChart } from '../../testing/line-chart';
import { smoothZoom } from './core';

describe('smooth zoom', () => {
  it('moves what is drawn part of the way to the target each frame', () => {
    const { chart } = mountLineChart([smoothZoom({ speed: 0.5 })]);
    chart.prepareFrame(0);

    chart.viewport.x.setTarget({ start: 40, end: 60 });
    chart.prepareFrame(1000 / 60);

    expect(chart.viewport.x.current.start).toBeCloseTo(20);
    expect(chart.viewport.x.current.end).toBeCloseTo(80);
    expect(chart.viewport.x.target).toEqual({ start: 40, end: 60 });
  });

  it('covers in one slow frame what two frames of the active rate would', () => {
    const framesOf = (times: readonly number[]): number => {
      const { chart } = mountLineChart([smoothZoom({ speed: 0.5 })]);
      chart.prepareFrame(0);
      chart.viewport.x.setTarget({ start: 40, end: 60 });
      times.forEach(now => chart.prepareFrame(now));
      return chart.viewport.x.current.start;
    };

    expect(framesOf([2000 / 60])).toBeCloseTo(framesOf([1000 / 60, 2000 / 60]));
  });

  it('lands exactly on the target and stops asking for frames', () => {
    const { chart } = mountLineChart([smoothZoom({ speed: 0.5 })]);
    chart.prepareFrame(0);
    chart.viewport.x.setTarget({ start: 40, end: 60 });

    for (let now = 16; now < 1000; now += 16) {
      chart.prepareFrame(now);
    }

    expect(chart.viewport.x.current).toEqual({ start: 40, end: 60 });
  });

  it('keeps the range per pixel when the chart is resized, then eases back', () => {
    const { chart, host } = mountLineChart([smoothZoom({ speed: 0.5 })]);
    chart.prepareFrame(0);

    host.resize({ width: 2000, height: 500, devicePixelRatio: 1 });
    chart.prepareFrame(16);

    const { current } = chart.viewport.x;
    expect(current.end - current.start).toBeGreaterThan(100);
    expect(current.end - current.start).toBeLessThan(200);
    expect((current.start + current.end) / 2).toBeCloseTo(50);
    expect(chart.viewport.x.target).toEqual({ start: 0, end: 100 });
  });
});
