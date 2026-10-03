import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';
import { describe, expect, it } from 'vitest';

import { staticData } from '../../data/static-data';
import { autoScaleY } from '../../extensions/auto-scale-y/core';
import { LINE_MARK } from '../../marks/line/core';
import { createLineStyle } from '../../marks/line/style';
import { createFakeHost } from '../../testing/fake-host';
import type { IChartOptions, TAnyExtension } from '../chart-options';
import { createChart } from '../create-chart';
import { scaleOf } from '../frame/chart-frame';
import { series } from '../series/series';
import { numberDomain } from '../viewport/number-domain';
import type { IScaleFrame } from './scale';
import { pixelToValue, valueToPixel } from './scale-mapping';

const SIZE = { width: 1000, height: 600, devicePixelRatio: 1 };
const style = createLineStyle<number>(LINE_MARK);

function lineOf(id: string, values: readonly number[], scale?: string) {
  return series({
    id,
    scale,
    data: staticData<number>({
      shape: 'point',
      points: values.map((value, index) => ({ x: index * 50, value })),
    }),
    style,
  });
}

type TOptions = Omit<IChartOptions<number, readonly TAnyExtension<number>[]>, 'x' | 'extensions'>;

function frameOf(options: TOptions, extensions: readonly TAnyExtension<number>[] = []) {
  const chart = createChart({
    x: { domain: numberDomain, start: 0, end: 100 },
    extensions,
    ...options,
  });
  chart.attach(createFakeHost(SIZE));
  const frame = chart.prepareFrame(0);
  assert(!isNil(frame), 'the chart has something to draw');
  return { chart, frame };
}

function scaleWith(overrides: Partial<IScaleFrame>): IScaleFrame {
  return {
    id: 'scale',
    paneId: 'main',
    side: 'left',
    order: 0,
    kind: 'linear',
    labels: 'value',
    min: 0,
    max: 100,
    inverted: false,
    visible: true,
    title: undefined,
    format: undefined,
    base: undefined,
    color: undefined,
    area: { top: 0, height: 500 },
    plot: { left: 0, top: 0, width: 1000, height: 500, right: 1000, bottom: 500 },
    ...overrides,
  };
}

describe('the value scales of a chart', () => {
  it('is one scale on the left of one pane when the chart names none', () => {
    const { frame } = frameOf({ series: [lineOf('line', [1, 2, 3])] });

    expect(frame.panes).toHaveLength(1);
    expect(frame.panes[0].scales).toMatchObject([
      { id: 'main', side: 'left', order: 0, kind: 'linear', labels: 'value' },
    ]);
    expect(frame.series[0].scaleId).toBe('main');
  });

  it('measures each series against the scale it names, and against the first when it names none', () => {
    const { frame } = frameOf({
      scales: [{ id: 'price' }, { id: 'volume', side: 'right' }],
      series: [lineOf('a', [1, 2, 3]), lineOf('b', [1, 2, 3], 'volume')],
    });

    expect(frame.series.map(each => each.scaleId)).toEqual(['price', 'volume']);
  });

  it('fits every scale to the series measured against it, and to nothing else', () => {
    const { frame } = frameOf(
      {
        scales: [{ id: 'small' }, { id: 'large', side: 'right' }],
        series: [lineOf('a', [1, 2, 3]), lineOf('b', [1000, 3000, 2000], 'large')],
      },
      [autoScaleY({ padding: 0 })]
    );

    expect(scaleOf(frame, 'small')).toMatchObject({ min: 1, max: 3 });
    expect(scaleOf(frame, 'large')).toMatchObject({ min: 1000, max: 3000 });
  });

  it('counts the scales on a side outward from the plot', () => {
    const { frame, chart } = frameOf({
      scales: [
        { id: 'a' },
        { id: 'b' },
        { id: 'c', side: 'right' },
        { id: 'd', side: 'right' },
        { id: 'e', side: 'right' },
      ],
      series: [lineOf('line', [1, 2, 3])],
    });

    expect(frame.panes[0].scales.map(scale => `${scale.id}:${scale.side}:${scale.order}`)).toEqual([
      'a:left:0',
      'b:left:1',
      'c:right:0',
      'd:right:1',
      'e:right:2',
    ]);
    expect(chart.scales.outerScales('left')).toBe(1);
    expect(chart.scales.outerScales('right')).toBe(2);
  });

  it('refuses a series that names a scale the chart does not have', () => {
    expect(() => frameOf({ series: [lineOf('line', [1, 2, 3], 'missing')] })).toThrow(
      /names the value scale "missing"/
    );
  });

  it('keeps the range a scale was given until something fits it', () => {
    const { frame } = frameOf({
      scales: [{ id: 'fixed', min: -5, max: 5 }],
      series: [lineOf('line', [1, 2, 3])],
    });

    expect(scaleOf(frame, 'fixed')).toMatchObject({ min: -5, max: 5 });
  });
});

describe('the ends of a scale', () => {
  it('holds the end it fixes and fits the other to the data', () => {
    const { frame } = frameOf(
      { scales: [{ id: 'volume', min: 0 }], series: [lineOf('line', [10, 30, 20])] },
      [autoScaleY({ padding: 0 })]
    );

    expect(scaleOf(frame, 'volume')).toMatchObject({ min: 0, max: 30 });
  });

  it('is not moved by the data when both ends are fixed', () => {
    const { frame } = frameOf(
      { scales: [{ id: 'share', min: 0, max: 100 }], series: [lineOf('line', [10, 300, 20])] },
      [autoScaleY()]
    );

    expect(scaleOf(frame, 'share')).toMatchObject({ min: 0, max: 100 });
  });

  it('keeps the height of the data above a fixed end that everything in view lies beyond', () => {
    const { frame } = frameOf(
      { scales: [{ id: 'above', min: 50 }], series: [lineOf('line', [10, 30, 20])] },
      [autoScaleY({ padding: 0 })]
    );

    expect(scaleOf(frame, 'above')).toMatchObject({ min: 50, max: 70 });
  });

  it('leaves the room the scale asks for, whatever the autoscale leaves the others', () => {
    const { frame } = frameOf(
      {
        scales: [{ id: 'tight' }, { id: 'roomy', side: 'right', padding: 0.5 }],
        series: [lineOf('a', [0, 100]), lineOf('b', [0, 100], 'roomy')],
      },
      [autoScaleY({ padding: 0 })]
    );

    expect(scaleOf(frame, 'tight')).toMatchObject({ min: 0, max: 100 });
    expect(scaleOf(frame, 'roomy')).toMatchObject({ min: -50, max: 150 });
  });

  it('refuses a fixed minimum that is not below the fixed maximum', () => {
    expect(() =>
      frameOf({ scales: [{ id: 'a', min: 5, max: 5 }], series: [lineOf('line', [1, 2])] })
    ).toThrow(/fixes a minimum that is not below its maximum/);
  });
});

describe('a hidden scale', () => {
  it('measures its series and takes no place beside the plot', () => {
    const { frame, chart } = frameOf({
      scales: [{ id: 'shown' }, { id: 'hidden', visible: false }, { id: 'next' }],
      series: [lineOf('a', [1, 2, 3]), lineOf('b', [1, 2, 3], 'hidden')],
    });

    expect(scaleOf(frame, 'hidden').visible).toBe(false);
    expect(scaleOf(frame, 'next').order).toBe(1);
    expect(chart.scales.outerScales('left')).toBe(1);
  });
});

describe('the panes of a chart', () => {
  const stacked: TOptions = {
    panes: [{ id: 'price', weight: 3 }, { id: 'volume' }],
    scales: [{ id: 'price' }, { id: 'volume', pane: 'volume' }],
    series: [lineOf('a', [1, 2, 3]), lineOf('b', [10, 20, 30], 'volume')],
  };

  it('stacks top to bottom by weight, sharing the X axis', () => {
    const { frame } = frameOf(stacked);
    const [price, volume] = frame.panes;

    expect(price.plot.top).toBe(frame.plot.top);
    expect(volume.plot.bottom).toBe(frame.plot.bottom);
    expect(price.plot.bottom).toBeLessThan(volume.plot.top);
    expect(price.plot.height / volume.plot.height).toBeGreaterThan(2.5);
    expect([price.plot.left, price.plot.width]).toEqual([volume.plot.left, volume.plot.width]);
  });

  it('spreads the range of a scale over its own pane', () => {
    const { frame } = frameOf(stacked, [autoScaleY({ padding: 0 })]);
    const volume = scaleOf(frame, 'volume');

    expect(volume.area).toEqual({ top: 450, height: 150 });
    expect(valueToPixel(volume, 10)).toBe(600);
    expect(valueToPixel(volume, 30)).toBe(450);
  });

  it('refuses a scale that names a pane the chart does not have', () => {
    expect(() =>
      frameOf({ scales: [{ id: 'a', pane: 'missing' }], series: [lineOf('line', [1, 2])] })
    ).toThrow(/names the pane "missing"/);
  });
});

describe('mapping a value to a height', () => {
  it('spreads a linear scale evenly, the maximum at the top', () => {
    const scale = scaleWith({ min: 0, max: 100 });

    expect([0, 25, 100].map(value => valueToPixel(scale, value))).toEqual([500, 375, 0]);
  });

  it('spreads a logarithmic scale by orders of magnitude', () => {
    const scale = scaleWith({ kind: 'log', min: 1, max: 1000 });

    expect(valueToPixel(scale, 1)).toBeCloseTo(500);
    expect(valueToPixel(scale, 10)).toBeCloseTo(333.33, 1);
    expect(valueToPixel(scale, 100)).toBeCloseTo(166.67, 1);
    expect(valueToPixel(scale, 1000)).toBeCloseTo(0);
  });

  it('puts the minimum of an inverted scale at the top', () => {
    const scale = scaleWith({ min: 0, max: 100, inverted: true });

    expect([0, 25, 100].map(value => valueToPixel(scale, value))).toEqual([0, 125, 500]);
  });

  it('reads a height back as the value it shows, on every kind of scale', () => {
    for (const scale of [
      scaleWith({}),
      scaleWith({ kind: 'log', min: 1, max: 1000 }),
      scaleWith({ inverted: true }),
    ]) {
      expect(pixelToValue(scale, valueToPixel(scale, 42))).toBeCloseTo(42);
    }
  });
});

describe('fitting a logarithmic scale', () => {
  it('leaves room as a ratio, the same above and below', () => {
    const { frame } = frameOf(
      { scales: [{ id: 'log', kind: 'log' }], series: [lineOf('line', [10, 1000, 100])] },
      [autoScaleY({ padding: 0.5 })]
    );
    const { min, max } = scaleOf(frame, 'log');

    expect(min).toBeCloseTo(1);
    expect(max).toBeCloseTo(10_000);
  });

  it('shows values at or below nought three orders under the maximum rather than break', () => {
    const { frame } = frameOf(
      { scales: [{ id: 'log', kind: 'log' }], series: [lineOf('line', [0, 1000, 100])] },
      [autoScaleY({ padding: 0 })]
    );

    expect(scaleOf(frame, 'log').min).toBeCloseTo(1);
  });
});

describe('a scale labelled in per cent', () => {
  it('counts from the first value in view', () => {
    const { chart, frame } = frameOf({
      scales: [{ id: 'change', labels: 'percent' }],
      series: [lineOf('line', [50, 60, 70])],
    });
    expect(scaleOf(frame, 'change').base).toBe(50);

    chart.viewport.x.jump({ start: 40, end: 140 });
    const moved = chart.prepareFrame(16);
    assert(!isNil(moved), 'the chart has something to draw');
    expect(scaleOf(moved, 'change').base).toBe(60);
  });

  it('has no base to count from on a scale labelled by value', () => {
    const { frame } = frameOf({ series: [lineOf('line', [50, 60, 70])] });

    expect(scaleOf(frame, 'main').base).toBeUndefined();
  });
});
