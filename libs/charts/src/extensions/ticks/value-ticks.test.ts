import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';
import { describe, expect, it } from 'vitest';

import { createChart } from '../../core/create-chart';
import { scaleOf } from '../../core/frame/chart-frame';
import type { IScaleOptions } from '../../core/scale/scale';
import { series } from '../../core/series/series';
import { numberDomain } from '../../core/viewport/number-domain';
import { staticData } from '../../data/static-data';
import { LINE_MARK } from '../../marks/line/core';
import { createLineStyle } from '../../marks/line/style';
import { createFakeHost } from '../../testing/fake-host';
import { logTickAxis } from '../../testing/tick-axis';
import { ticks } from './core';
import { linearTicks } from './linear-ticks';
import { logTicks } from './log-ticks';

function ticksOf(scale: IScaleOptions, values: readonly number[]) {
  const chart = createChart({
    x: { domain: numberDomain, start: 0, end: 100 },
    scales: [scale],
    series: [
      series({
        id: 'line',
        data: staticData<number>({
          shape: 'point',
          points: values.map((value, index) => ({ x: index * 50, value })),
        }),
        style: createLineStyle<number>(LINE_MARK),
      }),
    ],
    extensions: [ticks({ x: linearTicks() })],
  });
  chart.attach(createFakeHost({ width: 1000, height: 500, devicePixelRatio: 1 }));
  const frame = chart.prepareFrame(0);
  assert(!isNil(frame), 'the chart has something to draw');
  const frameScale = scaleOf(frame, scale.id);
  return {
    ticks: chart.ticks.valueTicks(frame, frameScale),
    format: (value: number) => chart.ticks.formatValue(frame, frameScale, value),
  };
}

describe('ticks of a value scale', () => {
  it('are written the way the scale asks, and so is any other value on it', () => {
    const { ticks: found, format } = ticksOf(
      { id: 'a', min: 0, max: 100, format: value => `${value} kg` },
      [1, 2]
    );

    expect(found.map(tick => tick.label)).toEqual([
      '0 kg',
      '20 kg',
      '40 kg',
      '60 kg',
      '80 kg',
      '100 kg',
    ]);
    expect(format(12.5)).toBe('12.5 kg');
  });

  it('stand at round values on a linear scale', () => {
    const { ticks: found } = ticksOf({ id: 'a', min: 0, max: 100 }, [1, 2]);

    expect(found.map(tick => tick.position)).toEqual([0, 20, 40, 60, 80, 100]);
  });

  it('stand at one, two and five of every power of ten on a logarithmic scale', () => {
    const { ticks: found } = ticksOf({ id: 'a', kind: 'log', min: 1, max: 1000 }, [1, 2]);

    expect(found.map(tick => tick.label)).toEqual([
      '1',
      '2',
      '5',
      '10',
      '20',
      '50',
      '100',
      '200',
      '500',
      '1000',
    ]);
  });

  it('stand at round percentages on a scale labelled in per cent, signed', () => {
    const { ticks: found, format } = ticksOf(
      { id: 'a', labels: 'percent', min: 180, max: 220 },
      [200, 210]
    );

    expect(found.map(tick => tick.label)).toEqual(['-10.0%', '-5.0%', '0.0%', '+5.0%', '+10.0%']);
    [180, 190, 200, 210, 220].forEach((value, index) => {
      expect(found[index].position).toBeCloseTo(value);
    });
    expect(format(205)).toBe('+2.5%');
  });
});

describe('logarithmic ticks', () => {
  it('thin to the powers of ten alone when the range spans many of them', () => {
    const found = logTicks().ticks(logTickAxis({ start: 1, end: 1e6 }, 600));

    expect(found.map(tick => tick.position)).toEqual([1, 10, 100, 1e3, 1e4, 1e5, 1e6]);
  });

  it('label values under one with the decimals they need', () => {
    const found = logTicks().ticks(logTickAxis({ start: 0.01, end: 1 }, 600));

    expect(found.map(tick => tick.label)).toEqual([
      '0.01',
      '0.02',
      '0.05',
      '0.1',
      '0.2',
      '0.5',
      '1',
    ]);
  });

  it('have nothing to say about a range that reaches nought', () => {
    expect(logTicks().ticks(logTickAxis({ start: 0, end: 100 }, 600))).toEqual([]);
  });
});
