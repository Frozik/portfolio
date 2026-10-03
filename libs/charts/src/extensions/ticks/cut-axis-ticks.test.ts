import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';
import { describe, expect, it } from 'vitest';

import { createChart } from '../../core/create-chart';
import { series } from '../../core/series/series';
import { numberDomain } from '../../core/viewport/number-domain';
import { staticData } from '../../data/static-data';
import { LINE_MARK } from '../../marks/line/core';
import { createLineStyle } from '../../marks/line/style';
import { createFakeHost } from '../../testing/fake-host';
import { ticks } from './core';
import { linearTicks } from './linear-ticks';

/** X 0…100 with 40…60 taken out, shown over 1000 pixels. */
function framed() {
  const chart = createChart({
    x: { domain: numberDomain, cuts: [{ from: 40, to: 60 }], start: 0, end: 100 },
    series: [
      series({
        id: 'line',
        data: staticData<number>({
          shape: 'point',
          points: [0, 100].map(x => ({ x, value: x })),
        }),
        style: createLineStyle<number>(LINE_MARK),
      }),
    ],
    extensions: [ticks({ x: linearTicks({ labelSizePx: 30 }) })],
  });
  chart.attach(createFakeHost({ width: 1000, height: 500, devicePixelRatio: 1 }));
  const frame = chart.prepareFrame(0);
  assert(!isNil(frame), 'the chart has something to draw');
  return { chart, frame };
}

describe('ticks of an axis with cuts', () => {
  it('stand where the frame draws them and say the world value, one tick for a cut', () => {
    const { chart, frame } = framed();

    expect(chart.ticks.xTicks(frame)).toEqual([
      { position: 0, label: '0' },
      { position: 20, label: '20' },
      { position: 40, label: '60' },
      { position: 60, label: '80' },
      { position: 80, label: '100' },
    ]);
  });

  it('write a position of the frame as the world value it shows, either edge of a cut on request', () => {
    const { chart, frame } = framed();

    expect(chart.ticks.formatX(frame, 70)).toBe('90');
    expect(chart.ticks.formatX(frame, 40)).toBe('60');
    expect(chart.ticks.formatX(frame, 40, 'before')).toBe('40');
  });
});
