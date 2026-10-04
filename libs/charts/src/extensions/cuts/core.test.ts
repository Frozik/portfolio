import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';
import { describe, expect, it, vi } from 'vitest';

import { createChart } from '../../core/create-chart';
import { series } from '../../core/series/series';
import type { ICut } from '../../core/viewport/cut';
import { numberDomain } from '../../core/viewport/number-domain';
import { staticData } from '../../data/static-data';
import { LINE_MARK } from '../../marks/line/core';
import { createLineStyle } from '../../marks/line/style';
import { createFakeHost } from '../../testing/fake-host';
import { cutsCore } from './core';

function stripsOf(cuts: readonly ICut<number>[] | undefined) {
  const chart = createChart({
    x: { domain: numberDomain, cuts, start: 0, end: 100 },
    series: [
      series({
        id: 'line',
        data: staticData<number>({
          shape: 'point',
          points: [
            { x: 0, value: 1 },
            { x: 100, value: 2 },
          ],
        }),
        style: createLineStyle<number>(LINE_MARK),
      }),
    ],
    extensions: [cutsCore<number>()],
  });
  chart.attach(createFakeHost({ width: 1000, height: 500, devicePixelRatio: 1 }));
  const frame = chart.prepareFrame(0);
  assert(!isNil(frame), 'the chart has something to draw');
  const lookups = isNil(frame.mapping) ? undefined : vi.spyOn(frame.mapping, 'firstCutIn');
  return { ...chart.cuts.cutsOf(frame), lookups: lookups?.mock.calls.length ?? 0 };
}

describe('the strips at the cuts of the axis', () => {
  it('stand where the chart draws each cut, down the whole plot', () => {
    const { strips, pattern } = stripsOf([{ from: 40, to: 60 }]);

    expect(strips).toEqual([{ left: 498, top: 10, width: 5, height: 480 }]);
    expect(pattern).toEqual({ kind: 'zigzag', period: 8, thickness: 1.5 });
  });

  it('leave out a strip that would run into the one before it', () => {
    const { strips } = stripsOf([
      { from: 40, to: 60 },
      { from: 60.2, to: 70 },
      { from: 80, to: 90 },
    ]);

    expect(strips.map(strip => strip.left)).toEqual([662, 831]);
  });

  it('cost as many lookups as there are strips, however many cuts the view holds', () => {
    const cuts = Array.from({ length: 5000 }, (_, index) => ({
      from: index * 0.02,
      to: index * 0.02 + 0.01,
    }));
    const stripsAcrossThePlot = 1000 / 8 + 1;
    const { strips, lookups } = stripsOf(cuts);

    expect(strips.length).toBeGreaterThan(100);
    expect(strips.length).toBeLessThanOrEqual(stripsAcrossThePlot);
    expect(lookups).toBeLessThanOrEqual(stripsAcrossThePlot);
  });

  it('draw nothing on an axis shown whole', () => {
    expect(stripsOf(undefined).strips).toEqual([]);
  });
});
