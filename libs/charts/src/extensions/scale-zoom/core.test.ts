import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';
import { describe, expect, it } from 'vitest';

import { createChart } from '../../core/create-chart';
import { scaleOf } from '../../core/frame/chart-frame';
import type { IPointerInput } from '../../core/host/pointer-source';
import type { IScaleOptions } from '../../core/scale/scale';
import { series } from '../../core/series/series';
import { numberDomain } from '../../core/viewport/number-domain';
import { staticData } from '../../data/static-data';
import { LINE_MARK } from '../../marks/line/core';
import { createLineStyle } from '../../marks/line/style';
import { createFakeHost } from '../../testing/fake-host';
import { autoScaleY } from '../auto-scale-y/core';
import { panZoom } from '../pan-zoom/core';
import { scaleZoom } from './core';

const SIZE = { width: 1000, height: 500, devicePixelRatio: 1 };
/** Inside the strip of the first scale on the left, halfway up the pane. */
const ON_SCALE = { x: 20, y: 250 };
const ON_PLOT = { x: 500, y: 250 };

function mounted(scale: IScaleOptions = { id: 'main' }, outer?: IScaleOptions) {
  const chart = createChart({
    x: { domain: numberDomain, start: 0, end: 100 },
    scales: isNil(outer) ? [scale] : [scale, outer],
    series: [
      series({
        id: 'line',
        data: staticData<number>({
          shape: 'point',
          points: [
            { x: 0, value: 0 },
            { x: 50, value: 50 },
            { x: 100, value: 100 },
          ],
        }),
        style: createLineStyle<number>(LINE_MARK),
      }),
    ],
    extensions: [autoScaleY({ padding: 0 }), scaleZoom(), panZoom()],
  });
  const host = createFakeHost(SIZE);
  chart.attach(host);
  let now = 0;
  const frame = () => {
    now += 16;
    const prepared = chart.prepareFrame(now);
    assert(!isNil(prepared), 'the chart has something to draw');
    return prepared;
  };
  const feed = (
    phase: IPointerInput['phase'],
    at: { readonly x: number; readonly y: number },
    options: { readonly delayMs?: number; readonly shiftKey?: boolean } = {}
  ) => {
    host.pointer.feed({
      phase,
      pointerId: 1,
      kind: 'mouse',
      timeStamp: now + (options.delayMs ?? 0),
      shiftKey: options.shiftKey ?? false,
      ...at,
    });
  };
  frame();
  return { chart, host, frame, feed, range: () => scaleOf(frame(), scale.id) };
}

describe('zooming a value scale', () => {
  it('stretches the scale under the wheel about the value under the pointer, and the X axis not at all', () => {
    const { chart, host, range } = mounted();

    host.pointer.wheel({ ...ON_SCALE, deltaY: 100, shiftKey: false });

    expect(range()).toMatchObject({ min: -15, max: 115 });
    expect(chart.viewport.target).toEqual({ start: 0, end: 100 });
  });

  it('doubles the range when the scale is dragged down over the height of its pane', () => {
    const { feed, range } = mounted();
    const paneHeight = range().plot.height;

    feed('down', ON_SCALE);
    feed('move', { x: ON_SCALE.x, y: ON_SCALE.y + paneHeight });
    feed('up', { x: ON_SCALE.x, y: ON_SCALE.y + paneHeight });

    expect(range().min).toBeCloseTo(-50);
    expect(range().max).toBeCloseTo(150);
  });

  it('keeps a stretched scale as it is however the chart moves along X', () => {
    const { chart, host, range } = mounted();
    host.pointer.wheel({ ...ON_SCALE, deltaY: 100, shiftKey: false });

    chart.viewport.jump({ start: 10, end: 110 });

    expect(range()).toMatchObject({ min: -15, max: 115 });
  });

  it('gives a scale back to the autoscale on a double tap on it', () => {
    const { host, feed, range } = mounted();
    host.pointer.wheel({ ...ON_SCALE, deltaY: 100, shiftKey: false });

    feed('down', ON_SCALE);
    feed('up', ON_SCALE);
    feed('down', ON_SCALE);
    feed('up', ON_SCALE);

    expect(range()).toMatchObject({ min: 0, max: 100 });
  });

  it('gives every scale of the pane back on a double tap on the plot, and does not pan', () => {
    const { chart, host, feed, range } = mounted();
    host.pointer.wheel({ ...ON_SCALE, deltaY: 100, shiftKey: false });

    feed('down', ON_PLOT);
    feed('up', ON_PLOT);
    feed('down', ON_PLOT);
    feed('move', { x: ON_PLOT.x + 50, y: ON_PLOT.y });
    feed('up', { x: ON_PLOT.x + 50, y: ON_PLOT.y });

    expect(range()).toMatchObject({ min: 0, max: 100 });
    expect(chart.viewport.current).toEqual({ start: 0, end: 100 });
  });

  it('takes two taps far apart in time for two single ones', () => {
    const { host, feed, range } = mounted();
    host.pointer.wheel({ ...ON_SCALE, deltaY: 100, shiftKey: false });

    feed('down', ON_SCALE);
    feed('up', ON_SCALE);
    feed('down', ON_SCALE, { delayMs: 1000 });
    feed('up', ON_SCALE, { delayMs: 1000 });

    expect(range()).toMatchObject({ min: -15, max: 115 });
  });

  it('works on a scale in its gutter beyond the plot, and on that one alone', () => {
    const { chart, host, frame } = mounted({ id: 'main' }, { id: 'outer', side: 'left' });
    const plotLeft = frame().plot.left;

    host.pointer.wheel({ x: plotLeft - 20, y: 250, deltaY: 100, shiftKey: false });

    expect(chart.scales.isHeld('outer')).toBe(true);
    expect(chart.scales.isHeld('main')).toBe(false);
    const { min, max } = chart.scales.rangeOf('outer');
    expect(min).toBeCloseTo(-0.15);
    expect(max).toBeCloseTo(1.15);
  });

  it('leaves a fixed end where it is', () => {
    const { host, range } = mounted({ id: 'main', min: 0 });

    host.pointer.wheel({ ...ON_SCALE, deltaY: 100, shiftKey: false });

    expect(range()).toMatchObject({ min: 0, max: 115 });
  });

  it('does not pan the chart when the drag starts on the scale', () => {
    const { chart, feed } = mounted();

    feed('down', ON_SCALE);
    feed('move', { x: ON_SCALE.x + 100, y: ON_SCALE.y });
    feed('up', { x: ON_SCALE.x + 100, y: ON_SCALE.y });

    expect(chart.viewport.current).toEqual({ start: 0, end: 100 });
  });

  it('moves every scale of the pane with a drag up or down the plot while Shift is held, and nothing along X', () => {
    const { chart, feed, range } = mounted();
    const halfway = range().area.height / 2;

    feed('down', ON_PLOT, { shiftKey: true });
    feed('move', { x: ON_PLOT.x + 100, y: ON_PLOT.y + halfway }, { shiftKey: true });
    feed('up', { x: ON_PLOT.x + 100, y: ON_PLOT.y + halfway }, { shiftKey: true });

    expect(range().min).toBeCloseTo(50);
    expect(range().max).toBeCloseTo(150);
    expect(chart.viewport.current).toEqual({ start: 0, end: 100 });
  });

  it('leaves the scales alone when a pan without Shift strays up or down', () => {
    const { chart, feed } = mounted();

    feed('down', ON_PLOT);
    feed('move', { x: ON_PLOT.x + 100, y: ON_PLOT.y + 30 });
    feed('up', { x: ON_PLOT.x + 100, y: ON_PLOT.y + 30 });

    expect(chart.viewport.current.start).toBeLessThan(0);
    expect(chart.scales.isHeld('main')).toBe(false);
  });

  it('moves the scales of the pane by the middle of two fingers and stretches them by their spread', () => {
    const { host, range } = mounted();
    const { area } = range();
    const quarter = area.height / 4;
    const finger = (phase: IPointerInput['phase'], pointerId: number, y: number) =>
      host.pointer.feed({
        phase,
        pointerId,
        kind: 'touch',
        x: 500,
        y,
        timeStamp: 0,
        shiftKey: false,
      });

    finger('down', 1, area.top + quarter);
    finger('down', 2, area.top + quarter * 3);
    finger('move', 1, area.top);
    finger('move', 2, area.top + area.height);

    expect(range().min).toBeCloseTo(25);
    expect(range().max).toBeCloseTo(75);
  });

  it('stretches every scale of the pane with the wheel while Shift is held, and leaves X alone', () => {
    const { chart, host, range } = mounted();

    host.pointer.wheel({ ...ON_PLOT, deltaY: 100, shiftKey: true });

    expect(range()).toMatchObject({ min: -15, max: 115 });
    expect(chart.viewport.target).toEqual({ start: 0, end: 100 });
  });

  it('zooms the X axis with the wheel over the plot without Shift, and holds no scale', () => {
    const { chart, host } = mounted();

    host.pointer.wheel({ ...ON_PLOT, deltaY: 100, shiftKey: false });

    expect(chart.viewport.target).not.toEqual({ start: 0, end: 100 });
    expect(chart.scales.isHeld('main')).toBe(false);
  });

  it('moves a scale instead of stretching it when it is dragged with Shift held', () => {
    const { feed, range } = mounted();
    const halfway = range().area.height / 2;

    feed('down', ON_SCALE, { shiftKey: true });
    feed('move', { x: ON_SCALE.x, y: ON_SCALE.y + halfway }, { shiftKey: true });
    feed('up', { x: ON_SCALE.x, y: ON_SCALE.y + halfway }, { shiftKey: true });

    expect(range().min).toBeCloseTo(50);
    expect(range().max).toBeCloseTo(150);
  });

  it('moves a scale a notch at a time with the wheel over it while Shift is held', () => {
    const { host, range } = mounted();

    host.pointer.wheel({ ...ON_SCALE, deltaY: 100, shiftKey: true });

    expect(range().min).toBeCloseTo(10);
    expect(range().max).toBeCloseTo(110);
  });

  it('shows a resize cursor over the scale and gives it back over the plot', () => {
    const { host, feed } = mounted();

    feed('move', ON_SCALE);
    expect(host.pointer.cursor).toBe('ns-resize');

    feed('move', ON_PLOT);
    expect(host.pointer.cursor).toBe('crosshair');
  });
});
