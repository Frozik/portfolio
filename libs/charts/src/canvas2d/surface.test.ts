import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';
import { describe, expect, it } from 'vitest';

import { createChart } from '../core/create-chart';
import type { IChartFrame } from '../core/frame/chart-frame';
import { rgba } from '../core/series/color';
import { ChartDataError } from '../core/series/data-error';
import { series } from '../core/series/series';
import type { IPaintContribution } from '../core/stage/backend';
import { PAINT_BAND } from '../core/stage/backend';
import { numberDomain } from '../core/viewport/number-domain';
import { staticData } from '../data/static-data';
import { ticks } from '../extensions/ticks/core';
import { linearTicks } from '../extensions/ticks/linear-ticks';
import { createFakeHost } from '../testing/fake-host';
import { mountLineChart } from '../testing/line-chart';
import { recordingContext } from '../testing/recording-context';
import { canvas2d } from './backend';
import { axes } from './extensions/axes/axes';
import { crosshair } from './extensions/crosshair/crosshair';
import { loadingIndicator } from './extensions/loading-indicator/loadingIndicator';
import { lineStyle } from './marks/line/lineStyle';
import type { TCanvasPainterFactory } from './painter';
import { CANVAS2D_BACKEND } from './painter';
import type { ITextMeasurer } from './text-measurer';

const GLYPH_WIDTH = 6;
const FIXED_WIDTH_TEXT: ITextMeasurer = {
  measureWidth: text => text.length * GLYPH_WIDTH,
  getGlyphMetrics: () => ({ ascent: 8, descent: 0, centerOffset: 4 }),
};

function surfaceFor(
  contributions: readonly IPaintContribution[],
  options: { readonly series?: boolean } = {}
) {
  const { context, calls } = recordingContext();
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'getContext', { value: () => context });
  const surface = canvas2d({ text: FIXED_WIDTH_TEXT }).createSurface(canvas, contributions, {
    drawsSeries: options.series ?? false,
  });
  return { surface, calls, canvas };
}

function frameOf<TX>(chart: { prepareFrame(now: number): IChartFrame<TX> | undefined }) {
  const frame = chart.prepareFrame(0);
  assert(!isNil(frame), 'the chart has something to draw');
  return frame;
}

function paintedBy(painter: TCanvasPainterFactory, band: number): IPaintContribution {
  return { id: 'test', backend: CANVAS2D_BACKEND, band, painter };
}

describe('the 2D canvas surface', () => {
  it('takes the size of the frame and paints', () => {
    const { chart } = mountLineChart([ticks({ x: linearTicks() }), axes()]);
    const { surface, calls, canvas } = surfaceFor(chart.paintContributions);

    surface.paint(frameOf(chart), 0);

    expect([canvas.width, canvas.height]).toEqual([1000, 500]);
    expect(calls.some(call => call.startsWith('fillText('))).toBe(true);
  });

  it('paints nothing again while the frame is the same', () => {
    const { chart } = mountLineChart([ticks({ x: linearTicks() }), axes()]);
    const { surface, calls } = surfaceFor(chart.paintContributions);
    const frame = frameOf(chart);
    surface.paint(frame, 0);
    calls.length = 0;

    surface.paint(frame, 16);

    expect(calls).toEqual([]);
  });

  it('repaints everything when one painter says its picture is out of date', () => {
    const order: string[] = [];
    const painter =
      (name: string, stale: boolean): TCanvasPainterFactory =>
      () => ({
        isStale: () => stale,
        paint: () => order.push(name),
      });
    const { chart } = mountLineChart([]);
    const { surface } = surfaceFor([
      paintedBy(painter('top', false), PAINT_BAND.crosshair),
      paintedBy(painter('bottom', true), PAINT_BAND.grid),
    ]);
    const frame = frameOf(chart);
    surface.paint(frame, 0);
    order.length = 0;

    surface.paint(frame, 16);

    expect(order).toEqual(['bottom', 'top']);
  });

  it('repaints when the crosshair moves though the frame did not change', () => {
    const { chart, host } = mountLineChart([ticks({ x: linearTicks() }), crosshair()]);
    const { surface, calls } = surfaceFor(chart.paintContributions);
    const frame = frameOf(chart);
    surface.paint(frame, 0);
    calls.length = 0;

    host.pointer.feed({ phase: 'move', pointerId: 1, kind: 'mouse', x: 500, y: 250, timeStamp: 0 });
    surface.paint(frame, 16);

    expect(calls).toContain('setLineDash(4,4)');
    expect(calls.filter(call => call.startsWith('fillText('))).toHaveLength(2);
  });

  it('keeps repainting while something is loading, for the shimmer', () => {
    const { chart } = mountLineChart([loadingIndicator()]);
    const { surface, calls } = surfaceFor(chart.paintContributions);
    const frame: IChartFrame<number> = { ...frameOf(chart), loading: [{ start: 20, end: 40 }] };
    surface.paint(frame, 0);
    calls.length = 0;

    surface.paint(frame, 16);

    expect(calls).toContain('rect(200, 495, 200, 5)');
  });

  function withFailures(...ranges: readonly (readonly [number, number])[]) {
    const { chart } = mountLineChart([loadingIndicator()]);
    const { surface, calls } = surfaceFor(chart.paintContributions);
    const frame: IChartFrame<number> = {
      ...frameOf(chart),
      failed: ranges.map(([start, end]) => ({
        range: { start, end },
        error: new ChartDataError('UNAVAILABLE', 'down'),
      })),
    };
    return { surface, calls, frame };
  }

  function withFailure(start: number, end: number) {
    return withFailures([start, end]);
  }

  it('marks a range that failed to load with a bar along the bottom edge', () => {
    const { surface, calls, frame } = withFailure(50, 100);

    surface.paint(frame, 0);

    expect(calls).toContain('fillRect(500, 495, 500, 5)');
  });

  it('washes the plot over a failed range with a faint red, inside the plot only', () => {
    const { surface, calls, frame } = withFailure(50, 100);

    surface.paint(frame, 0);

    expect(calls.some(call => call.startsWith('fillStyle = rgba(230, 64, 51, 0.07'))).toBe(true);
    expect(calls).toContain('fillRect(500, 10, 490, 480)');
  });

  it('keeps the wash moving: a soft glow travels across the failed range', () => {
    const { surface, calls, frame } = withFailure(50, 100);
    surface.paint(frame, 0);
    const glowAt = (): string | undefined =>
      calls.findLast(call => call.startsWith('createLinearGradient('));
    const first = glowAt();
    calls.length = 0;

    surface.paint(frame, 650);

    expect(glowAt()).toBeDefined();
    expect(glowAt()).not.toBe(first);
  });

  it('washes ranges that overlap once, from the leftmost start: several series failing do not darken each other', () => {
    const { surface, calls, frame } = withFailures([60, 100], [50, 80], [55, 100]);

    surface.paint(frame, 0);

    const plotFills = calls.filter(call => /^fillRect\(\d+, 10, /.test(call));
    expect(plotFills).toEqual(['fillRect(500, 10, 490, 480)', 'fillRect(500, 10, 490, 480)']);
    expect(calls.filter(call => /^fillRect\(\d+, 495, /.test(call))).toEqual([
      'fillRect(500, 495, 500, 5)',
    ]);
  });

  it('washes ranges that lie apart each on its own', () => {
    const { surface, calls, frame } = withFailures([10, 20], [60, 70]);

    surface.paint(frame, 0);

    expect(calls.filter(call => /^fillRect\(\d+, 495, /.test(call))).toEqual([
      'fillRect(100, 495, 100, 5)',
      'fillRect(600, 495, 100, 5)',
    ]);
  });

  it('washes nothing where the failed range is off the screen', () => {
    const { surface, calls, frame } = withFailure(500, 900);

    surface.paint(frame, 0);

    expect(calls.filter(call => call.startsWith('fillRect('))).toEqual([]);
  });

  it('is transparent as an overlay and fills the background when it draws the series', () => {
    const { chart } = mountLineChart([]);
    const overlay = surfaceFor([]);
    const alone = surfaceFor([], { series: true });
    const frame: IChartFrame<number> = { ...frameOf(chart), series: [] };

    overlay.surface.paint(frame, 0);
    alone.surface.paint(frame, 0);

    expect(overlay.calls).not.toContain('fillRect(0, 0, 1000, 500)');
    expect(alone.calls).toContain('fillRect(0, 0, 1000, 500)');
  });
});

describe('the line mark on the 2D canvas', () => {
  function drawn(points: readonly { x: number; value: number }[], style = lineStyle<number>()) {
    const scene = createChart({
      x: { domain: numberDomain, start: 0, end: 100 },
      y: { min: 0, max: 100 },
      series: [series({ id: 'line', data: staticData<number>({ shape: 'point', points }), style })],
      extensions: [],
    });
    scene.attach(createFakeHost({ width: 1000, height: 500, devicePixelRatio: 1 }));
    const { surface, calls } = surfaceFor([], { series: true });
    surface.paint(frameOf(scene), 0);
    return calls;
  }

  it('runs one path through the points', () => {
    const calls = drawn([
      { x: 0, value: 0 },
      { x: 50, value: 50 },
      { x: 100, value: 100 },
    ]);

    expect(calls.filter(call => call.startsWith('moveTo('))).toEqual(['moveTo(0, 500)']);
    expect(calls.filter(call => call.startsWith('lineTo('))).toEqual([
      'lineTo(500, 250)',
      'lineTo(1000, 0)',
    ]);
    expect(calls.filter(call => call === 'stroke()')).toHaveLength(1);
  });

  it('breaks the line at a gap', () => {
    const calls = drawn([
      { x: 0, value: 0 },
      { x: 25, value: 25 },
      { x: 50, value: Number.NaN },
      { x: 75, value: 75 },
      { x: 100, value: 100 },
    ]);

    expect(calls.filter(call => call.startsWith('moveTo('))).toHaveLength(2);
    expect(calls.filter(call => call === 'stroke()')).toHaveLength(2);
  });

  it('draws an outline under the line, wider by the stroke on both sides', () => {
    const calls = drawn(
      [
        { x: 0, value: 0 },
        { x: 100, value: 100 },
      ],
      lineStyle<number>({ size: 4, stroke: { color: rgba(1, 1, 1), size: 1 } })
    );

    expect(calls.filter(call => call.startsWith('lineWidth = '))).toEqual([
      'lineWidth = 6',
      'lineWidth = 4',
    ]);
  });

  it('puts a corner between neighbours of a stepped line', () => {
    const calls = drawn(
      [
        { x: 0, value: 0 },
        { x: 100, value: 100 },
      ],
      lineStyle<number>({ join: 'stepAfter' })
    );

    expect(calls.filter(call => call.startsWith('lineTo('))).toEqual([
      'lineTo(1000, 500)',
      'lineTo(1000, 0)',
    ]);
  });
});
