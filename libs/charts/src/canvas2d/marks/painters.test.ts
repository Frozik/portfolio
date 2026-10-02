import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';
import { describe, expect, it } from 'vitest';

import { createChart } from '../../core/create-chart';
import { rgba } from '../../core/series/color';
import { series } from '../../core/series/series';
import type { TBatch } from '../../core/series/shape';
import type { IStyleProcessor } from '../../core/series/style-processor';
import { numberDomain } from '../../core/viewport/number-domain';
import { staticData } from '../../data/static-data';
import { createFakeHost } from '../../testing/fake-host';
import { recordingContext } from '../../testing/recording-context';
import { canvas2d } from '../backend';
import { areaStyle } from './area/areaStyle';
import { candleStyle } from './candle/candleStyle';
import { columnStyle } from './column/columnStyle';
import { markerStyle } from './marker/markerStyle';
import { ringStyle } from './marker/ringStyle';

const RED = rgba(1, 0, 0);
const BLUE = rgba(0, 0, 1);
const WHITE = rgba(1, 1, 1);
const TEXT = {
  measureWidth: (text: string) => text.length,
  getGlyphMetrics: () => ({ ascent: 8, descent: 0, centerOffset: 4 }),
};

/** What the 2D canvas is asked to draw for one series on a 1000×500 chart showing X 0…100 and values 0…100. */
function drawn(batch: TBatch<number>, style: IStyleProcessor<number>, step?: number): string[] {
  const chart = createChart({
    x: { domain: numberDomain, start: 0, end: 100 },
    y: { min: 0, max: 100 },
    series: [series({ id: 'series', data: staticData<number>(batch, { step }), style })],
    extensions: [],
  });
  chart.attach(createFakeHost({ width: 1000, height: 500, devicePixelRatio: 1 }));
  const frame = chart.prepareFrame(0);
  assert(!isNil(frame), 'the chart has something to draw');

  const { context, calls } = recordingContext();
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'getContext', { value: () => context });
  canvas2d({ text: TEXT }).createSurface(canvas, [], { drawsSeries: true }).paint(frame, 0);
  return calls;
}

function points(...values: readonly number[]): TBatch<number> {
  return {
    shape: 'point',
    points: values.map((value, index) => ({ x: index * 50, value })),
  };
}

describe('the area mark on the 2D canvas', () => {
  it('fills one band from the line down to the bottom of the plot', () => {
    const calls = drawn(points(0, 50, 100), areaStyle<number>({ color: RED }));
    const path = calls.filter(call => /^(moveTo|lineTo|closePath|fill)\(/.test(call));

    expect(path).toEqual([
      'moveTo(0, 490)',
      'lineTo(0, 500)',
      'lineTo(500, 250)',
      'lineTo(1000, 0)',
      'lineTo(1000, 490)',
      'closePath()',
      'fill()',
    ]);
  });

  it('breaks the band at a gap', () => {
    const calls = drawn(
      {
        shape: 'point',
        points: [0, 20, 40, 60, 80].map((x, index) => ({
          x,
          value: index === 2 ? Number.NaN : 50,
        })),
      },
      areaStyle<number>()
    );

    expect(calls.filter(call => call === 'fill()')).toHaveLength(2);
  });

  it('reaches to a baseline given as a value', () => {
    const calls = drawn(points(100, 100, 100), areaStyle<number>({ baseline: 50 }));

    expect(calls).toContain('moveTo(0, 250)');
  });

  it('fills each segment in the colour of the element it starts at when colours differ', () => {
    const calls = drawn(
      points(50, 50, 50),
      areaStyle<number>({ color: (_sample, index) => (index === 0 ? RED : BLUE) })
    );

    expect(calls.filter(call => call.startsWith('fillStyle = rgba(255, 0, 0'))).toHaveLength(1);
    expect(calls.filter(call => call.startsWith('fillStyle = rgba(0, 0, 255'))).toHaveLength(1);
    expect(calls.filter(call => call === 'fill()')).toHaveLength(2);
  });

  it('draws the line along its edge with the stroke of the style', () => {
    const calls = drawn(points(0, 100), areaStyle<number>({ line: { color: WHITE, size: 3 } }));

    expect(calls).toContain('lineWidth = 3');
    expect(calls).toContain('stroke()');
  });
});

describe('the marker mark on the 2D canvas', () => {
  it('draws a circle of the size of the style on every point', () => {
    const calls = drawn(points(50, 50), markerStyle<number>({ size: 10 }));

    expect(calls.filter(call => call.startsWith('arc('))).toEqual([
      `arc(0, 250, 5, 0, ${Math.PI * 2})`,
      `arc(500, 250, 5, 0, ${Math.PI * 2})`,
    ]);
  });

  it('draws the polygon of a figure, the right way up', () => {
    const calls = drawn(points(50), markerStyle<number>({ figure: 'square', size: 10 }));
    const path = calls.filter(call => /^(moveTo|lineTo)\(/.test(call));

    expect(path).toEqual([
      'moveTo(-5, 255)',
      'lineTo(-5, 245)',
      'lineTo(5, 245)',
      'lineTo(5, 255)',
    ]);
  });

  it('puts no marker on a gap', () => {
    const calls = drawn(points(50, Number.NaN, 50), markerStyle<number>());

    expect(calls.filter(call => call.startsWith('arc('))).toHaveLength(2);
  });

  it('keeps the outline inside the figure: stroked at twice the width, clipped to the figure', () => {
    const calls = drawn(points(50), ringStyle<number>({ size: 12, width: 2, color: RED }));

    expect(calls).toContain('clip()');
    expect(calls).toContain('lineWidth = 4');
    expect(calls).toContain('stroke()');
  });

  it('stands on each of the four points of a candle', () => {
    const calls = drawn(
      { shape: 'candle', candles: [{ x: 0, open: 10, min: 0, max: 30, close: 20 }] },
      markerStyle<number>({ shape: 'candle' }),
      40
    );

    expect(calls.filter(call => call.startsWith('arc(')).map(call => call.split(', ')[0])).toEqual([
      'arc(50',
      'arc(150',
      'arc(250',
      'arc(350',
    ]);
  });
});

describe('the candle mark on the 2D canvas', () => {
  const candle = (open: number, close: number): TBatch<number> => ({
    shape: 'candle',
    candles: [{ x: 0, open, min: 10, max: 90, close }],
  });

  it('draws a body from open to close, mid-interval, and a wick above and below it — never through it', () => {
    const calls = drawn(
      candle(40, 60),
      candleStyle<number>({ width: 10, gap: 0, stroke: { size: 0 } }),
      20
    );

    expect(calls.filter(call => call.startsWith('fillRect('))).toEqual([
      'fillRect(0, 0, 1000, 500)',
      'fillRect(99.5, 50, 1, 150)',
      'fillRect(99.5, 300, 1, 150)',
      'fillRect(95, 200, 10, 100)',
    ]);
  });

  it('narrows the body to what the interval leaves once the gap is kept', () => {
    const calls = drawn(candle(40, 60), candleStyle<number>({ width: 50, gap: 4 }), 2);

    expect(calls).toContain('fillRect(2, 200, 16, 100)');
  });

  it('draws no wick on the side where the body reaches the extreme', () => {
    const calls = drawn(
      { shape: 'candle', candles: [{ x: 0, open: 10, min: 10, max: 90, close: 60 }] },
      candleStyle<number>({ width: 10, gap: 0, stroke: { size: 0 } }),
      20
    );

    expect(calls.filter(call => call.startsWith('fillRect(99.5'))).toEqual([
      'fillRect(99.5, 50, 1, 150)',
    ]);
  });

  it('never lets a body with no height disappear', () => {
    const calls = drawn(candle(50, 50), candleStyle<number>({ width: 10, gap: 0 }), 20);

    expect(calls).toContain('fillRect(95, 249.5, 10, 1)');
  });

  it('colours a rising candle and a falling one differently', () => {
    const rising = drawn(candle(40, 60), candleStyle<number>({ up: RED, down: BLUE }), 20);
    const falling = drawn(candle(60, 40), candleStyle<number>({ up: RED, down: BLUE }), 20);

    expect(rising.some(call => call.startsWith('fillStyle = rgba(255, 0, 0'))).toBe(true);
    expect(falling.some(call => call.startsWith('fillStyle = rgba(0, 0, 255'))).toBe(true);
  });
});

describe('the column mark on the 2D canvas', () => {
  it('stands a column from the bottom of the plot to each value', () => {
    const calls = drawn(points(50, 100), columnStyle<number>({ width: 10, gap: 0 }));

    expect(calls.filter(call => call.startsWith('fillRect(')).slice(1)).toEqual([
      'fillRect(-5, 250, 10, 240)',
      'fillRect(495, 0, 10, 490)',
    ]);
  });

  it('stands a histogram on nought: up for what is above it, down for what is below', () => {
    const chart = drawn(
      { shape: 'point', points: [{ x: 50, value: 75 }] },
      columnStyle<number>({ width: 10, gap: 0, baseline: 50 })
    );
    const below = drawn(
      { shape: 'point', points: [{ x: 50, value: 25 }] },
      columnStyle<number>({ width: 10, gap: 0, baseline: 50 })
    );

    expect(chart).toContain('fillRect(495, 125, 10, 125)');
    expect(below).toContain('fillRect(495, 250, 10, 125)');
  });

  it('narrows to what the interval leaves once the gap is kept, and stands mid-interval', () => {
    const calls = drawn(points(100), columnStyle<number>({ width: 50, gap: 4 }), 2);

    expect(calls).toContain('fillRect(2, 0, 16, 490)');
  });

  it('puts no column on a gap', () => {
    const calls = drawn(points(50, Number.NaN, 50), columnStyle<number>({ width: 10, gap: 0 }));

    expect(calls.filter(call => call.startsWith('fillRect('))).toHaveLength(3);
  });
});
