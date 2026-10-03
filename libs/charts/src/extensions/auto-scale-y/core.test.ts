import { describe, expect, it } from 'vitest';

import { staticData } from '../../data/static-data';
import { mountLineChart } from '../../testing/line-chart';
import { autoScaleY } from './core';

describe('auto scale of the value axis', () => {
  it('fits the values in view with room above and below', () => {
    const { chart } = mountLineChart([autoScaleY({ padding: 0.1 })]);

    chart.prepareFrame(0);

    expect(chart.viewport.scale('main').current).toEqual({ start: 8, end: 32 });
  });

  it('follows the visible part of the data, not all of it', () => {
    const { chart } = mountLineChart([autoScaleY({ padding: 0 })]);
    chart.viewport.x.jump({ start: 40, end: 110 });

    chart.prepareFrame(0);

    expect(chart.viewport.scale('main').current).toEqual({ start: 20, end: 30 });
  });

  it('keeps the axis as it was when what is visible has no height', () => {
    const flat = staticData<number>({
      shape: 'point',
      points: [
        { x: 0, value: 5 },
        { x: 100, value: 5 },
      ],
    });
    const { chart } = mountLineChart([autoScaleY()], { data: flat });
    const before = chart.viewport.scale('main').current;

    chart.prepareFrame(0);

    expect(chart.viewport.scale('main').current).toEqual(before);
  });
});
