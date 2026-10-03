import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';
import { describe, expect, it } from 'vitest';

import { createChart } from '../../core/create-chart';
import { rgba } from '../../core/series/color';
import { series } from '../../core/series/series';
import { numberDomain } from '../../core/viewport/number-domain';
import { staticData } from '../../data/static-data';
import { CANDLE_MARK } from '../../marks/candle/core';
import { createCandleStyle } from '../../marks/candle/style';
import { LINE_MARK } from '../../marks/line/core';
import { createLineStyle } from '../../marks/line/style';
import { MARKER_MARK } from '../../marks/marker/core';
import { createRingStyle } from '../../marks/marker/style';
import { createFakeHost } from '../../testing/fake-host';
import type { ICrosshairOptions } from '../crosshair/core';
import { crosshairCore } from '../crosshair/core';
import { ticks } from '../ticks/core';
import { linearTicks } from '../ticks/linear-ticks';
import { legendCore } from './core';

const RED = rgba(1, 0, 0);
const GREEN = rgba(0, 1, 0);
const BLUE = rgba(0, 0, 1);

function scene(options: ICrosshairOptions = {}) {
  const chart = createChart({
    x: { domain: numberDomain, start: 0, end: 100 },
    y: { min: 0, max: 100 },
    panes: [{ id: 'price' }, { id: 'depth' }],
    scales: [{ id: 'price' }, { id: 'depth', pane: 'depth', min: 0, max: 10 }],
    series: [
      series({
        id: 'line',
        name: 'Price',
        data: staticData<number>({
          shape: 'point',
          points: [
            { x: 0, value: 10 },
            { x: 40, value: 20 },
            { x: 80, value: Number.NaN },
          ],
        }),
        style: createLineStyle<number>(LINE_MARK, { color: RED }),
      }),
      series({
        id: 'candles',
        data: staticData<number>({
          shape: 'candle',
          candles: [{ x: 40, open: 1, min: 0.5, max: 3, close: 2 }],
        }),
        style: createCandleStyle<number>(CANDLE_MARK, { up: GREEN }),
      }),
      series({
        id: 'rings',
        scale: 'depth',
        data: staticData<number>({ shape: 'point', points: [{ x: 60, value: 5 }] }),
        style: createRingStyle<number>(MARKER_MARK, { color: BLUE }),
      }),
    ],
    extensions: [ticks({ x: linearTicks() }), crosshairCore<number>(options), legendCore<number>()],
  });
  const host = createFakeHost({ width: 1000, height: 500, devicePixelRatio: 1 });
  chart.attach(host);
  const frame = chart.prepareFrame(0);
  assert(!isNil(frame), 'the chart has something to draw');
  const pointAt = (x: number): void =>
    host.pointer.feed({
      phase: 'move',
      pointerId: 1,
      kind: 'mouse',
      shiftKey: false,
      x,
      y: 100,
      timeStamp: 0,
    });
  return { chart, frame, pointAt };
}

describe('the legend', () => {
  it('reads the last element in view of every series while nothing is pointed at', () => {
    const { chart, frame } = scene();

    const entries = chart.legend.entriesOf(frame);

    expect(entries.map(entry => [entry.seriesId, entry.x])).toEqual([
      ['line', 80],
      ['candles', 40],
      ['rings', 60],
    ]);
  });

  it('reads the element of each series nearest to the pointer, not a value in between', () => {
    const { chart, frame, pointAt } = scene();

    pointAt(300);
    const [line] = chart.legend.entriesOf(frame);

    expect(line.x).toBe(40);
    expect(line.sample.value).toBe(20);
  });

  it('calls a series by its name, or by its id when it has none', () => {
    const { chart, frame } = scene();

    expect(chart.legend.entriesOf(frame).map(entry => entry.name)).toEqual([
      'Price',
      'candles',
      'rings',
    ]);
  });

  it('writes one value for a point and open, high, low, close for a candle', () => {
    const { chart, frame, pointAt } = scene();
    pointAt(400);

    const [line, candles] = chart.legend.entriesOf(frame);

    expect(line.values.map(value => value.label)).toEqual(['']);
    expect(candles.values.map(value => value.label)).toEqual(['O', 'H', 'L', 'C']);
    expect(candles.values.map(value => Number(value.text))).toEqual([1, 3, 0.5, 2]);
  });

  it('writes a dash for a gap', () => {
    const { chart, frame, pointAt } = scene();
    pointAt(800);

    expect(chart.legend.entriesOf(frame)[0].values[0].text).toBe('—');
  });

  it('takes the colour the element is drawn in: its fill, or its stroke when it is hollow', () => {
    const { chart, frame } = scene();

    const [line, candles, rings] = chart.legend.entriesOf(frame);

    expect([line.color, candles.color, rings.color]).toEqual([RED, GREEN, BLUE]);
  });

  it('says which pane each series belongs to', () => {
    const { chart, frame } = scene();

    expect(chart.legend.entriesOf(frame).map(entry => entry.paneId)).toEqual([
      'price',
      'price',
      'depth',
    ]);
  });

  it('changes its pointer whenever the pointer moves, so painters know to draw again', () => {
    const { chart, pointAt } = scene();
    const before = chart.legend.pointer;

    pointAt(300);

    expect(chart.legend.pointer).not.toBe(before);
  });
});

describe('a crosshair that snaps', () => {
  it('stands on the nearest element of the series it is told to snap to, and reports its position', () => {
    const { chart, frame, pointAt } = scene({ snap: ['line'] });

    pointAt(330);
    const crosshair = chart.crosshair.crosshairOf(frame);

    expect(crosshair?.x).toBe(40);
    expect(crosshair?.lineLeft).toBe(400);
  });

  it('takes no notice of the series it was not told about', () => {
    const { chart, frame, pointAt } = scene({ snap: ['line'] });

    pointAt(620);

    expect(chart.crosshair.crosshairOf(frame)?.x).toBe(80);
  });

  it('picks the nearest element among several series', () => {
    const { chart, frame, pointAt } = scene({ snap: ['line', 'rings'] });

    pointAt(620);
    expect(chart.crosshair.crosshairOf(frame)?.x).toBe(60);

    pointAt(380);
    expect(chart.crosshair.crosshairOf(frame)?.x).toBe(40);
  });

  it('points at a candle in the middle of its interval, where it is drawn', () => {
    const chart = createChart({
      x: { domain: numberDomain, start: 0, end: 100 },
      series: [
        series({
          id: 'candles',
          data: staticData<number>(
            { shape: 'candle', candles: [{ x: 40, open: 1, min: 0.5, max: 3, close: 2 }] },
            { step: 10 }
          ),
          style: createCandleStyle<number>(CANDLE_MARK),
        }),
      ],
      extensions: [ticks({ x: linearTicks() }), crosshairCore<number>({ snap: ['candles'] })],
    });
    const host = createFakeHost({ width: 1000, height: 500, devicePixelRatio: 1 });
    chart.attach(host);
    const frame = chart.prepareFrame(0);
    assert(!isNil(frame), 'the chart has something to draw');

    host.pointer.feed({
      phase: 'move',
      pointerId: 1,
      kind: 'mouse',
      shiftKey: false,
      x: 300,
      y: 100,
      timeStamp: 0,
    });
    const crosshair = chart.crosshair.crosshairOf(frame);

    expect(crosshair?.x).toBe(40);
    expect(crosshair?.lineLeft).toBe(450);
  });

  it('stands under the pointer while the series it snaps to have nothing to show', () => {
    const chart = createChart({
      x: { domain: numberDomain, start: 0, end: 100 },
      series: [
        series({
          id: 'line',
          data: staticData<number>({ shape: 'point', points: [{ x: 10, value: 1 }] }),
          style: createLineStyle<number>(LINE_MARK),
        }),
        series({
          id: 'empty',
          data: staticData<number>({ shape: 'point', points: [] }),
          style: createLineStyle<number>(LINE_MARK),
        }),
      ],
      extensions: [ticks({ x: linearTicks() }), crosshairCore<number>({ snap: ['empty'] })],
    });
    const host = createFakeHost({ width: 1000, height: 500, devicePixelRatio: 1 });
    chart.attach(host);
    const frame = chart.prepareFrame(0);
    assert(!isNil(frame), 'the chart has something to draw');

    host.pointer.feed({
      phase: 'move',
      pointerId: 1,
      kind: 'mouse',
      shiftKey: false,
      x: 330,
      y: 100,
      timeStamp: 0,
    });

    expect(chart.crosshair.crosshairOf(frame)?.lineLeft).toBe(330);
  });

  it('refuses to snap to a series the chart does not have', () => {
    expect(() => scene({ snap: ['missing'] })).toThrow(/snaps to the series "missing"/);
  });

  it('stands under the pointer itself when it does not snap', () => {
    const { chart, frame, pointAt } = scene();

    pointAt(330);

    expect(chart.crosshair.crosshairOf(frame)?.lineLeft).toBe(330);
  });

  it('reads its height on the scale of the pane it is over', () => {
    const { chart, frame, pointAt } = scene();

    pointAt(300);
    const crosshair = chart.crosshair.crosshairOf(frame);

    expect(crosshair?.values.map(value => value.scale.id)).toEqual(['price']);
  });
});
