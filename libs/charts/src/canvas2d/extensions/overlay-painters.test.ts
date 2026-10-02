import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';
import { describe, expect, it } from 'vitest';

import type { TAnyExtension } from '../../core/chart-options';
import { createChart } from '../../core/create-chart';
import type { IScaleOptions } from '../../core/scale/scale';
import { rgba } from '../../core/series/color';
import { series } from '../../core/series/series';
import { numberDomain } from '../../core/viewport/number-domain';
import { staticData } from '../../data/static-data';
import { ticks } from '../../extensions/ticks/core';
import { linearTicks } from '../../extensions/ticks/linear-ticks';
import { LINE_MARK } from '../../marks/line/core';
import { createLineStyle } from '../../marks/line/style';
import { createFakeHost } from '../../testing/fake-host';
import { recordingContext } from '../../testing/recording-context';
import { canvas2d } from '../backend';
import { annotations } from './annotations/annotations';
import { axes } from './axes/axes';
import { crosshair } from './crosshair/crosshair';
import { legend } from './legend/legend';

const TEXT = {
  measureWidth: (text: string) => text.length * 6,
  getGlyphMetrics: () => ({ ascent: 8, descent: 0, centerOffset: 4 }),
};
const ORANGE = rgba(1, 0.5, 0);

function painted(
  scales: readonly IScaleOptions[],
  extensions: readonly TAnyExtension<number>[],
  pointer?: { readonly x: number; readonly y: number }
) {
  const chart = createChart({
    x: { domain: numberDomain, start: 0, end: 100 },
    scales,
    series: [
      series({
        id: 'line',
        name: 'Price',
        data: staticData<number>({
          shape: 'point',
          points: [
            { x: 0, value: 10 },
            { x: 100, value: 90 },
          ],
        }),
        style: createLineStyle<number>(LINE_MARK),
      }),
    ],
    extensions: [ticks({ x: linearTicks() }), ...extensions],
  });
  const host = createFakeHost({ width: 1000, height: 500, devicePixelRatio: 1 });
  chart.attach(host);
  if (!isNil(pointer)) {
    host.pointer.feed({ phase: 'move', pointerId: 1, kind: 'mouse', timeStamp: 0, ...pointer });
  }
  const frame = chart.prepareFrame(0);
  assert(!isNil(frame), 'the chart has something to draw');

  const { context, calls } = recordingContext();
  const canvas = document.createElement('canvas');
  Object.defineProperty(canvas, 'getContext', { value: () => context });
  canvas2d({ text: TEXT })
    .createSurface(canvas, chart.paintContributions, { drawsSeries: false })
    .paint(frame, 0);
  return { calls, frame };
}

function verticalLines(calls: readonly string[]): readonly number[] {
  const starts: number[] = [];
  calls.forEach((call, index) => {
    const from = /^moveTo\(([-\d.]+), ([-\d.]+)\)$/.exec(call);
    const to = /^lineTo\(([-\d.]+), ([-\d.]+)\)$/.exec(calls[index + 1] ?? '');
    if (!isNil(from) && !isNil(to) && from[1] === to[1] && Number(to[2]) - Number(from[2]) > 100) {
      starts.push(Number(from[1]));
    }
  });
  return starts;
}

describe('the axes on the 2D canvas', () => {
  const RANGE = { min: 0, max: 100 };

  it('stand a single scale on the left edge of the plot, its labels inside', () => {
    const { calls, frame } = painted([{ id: 'a', ...RANGE }], [axes()]);

    expect(frame.plot.left).toBe(10);
    expect(verticalLines(calls)).toEqual([10]);
    expect(calls).toContain('textAlign = start');
  });

  it('stand a scale on the right on the right edge, its labels ending before it', () => {
    const { calls, frame } = painted([{ id: 'a', side: 'right', ...RANGE }], [axes()]);

    expect(verticalLines(calls)).toEqual([frame.plot.right]);
    expect(calls).toContain('textAlign = end');
  });

  it('give every further scale on a side a gutter of its own beyond the plot', () => {
    const { calls, frame } = painted(
      [
        { id: 'a', ...RANGE },
        { id: 'b', ...RANGE },
        { id: 'c', side: 'right', ...RANGE },
        { id: 'd', side: 'right', ...RANGE },
        { id: 'e', side: 'right', ...RANGE },
      ],
      [axes()]
    );

    expect([frame.plot.left, frame.plot.right]).toEqual([66, 878]);
    expect(verticalLines(calls)).toEqual([66, 10, 878, 934, 990]);
  });

  it('draw nothing for a hidden scale, and give it no gutter', () => {
    const { calls, frame } = painted(
      [
        { id: 'a', ...RANGE },
        { id: 'b', ...RANGE, visible: false },
      ],
      [axes()]
    );

    expect(frame.plot.left).toBe(10);
    expect(verticalLines(calls)).toEqual([10]);
  });

  it('write the title of a scale at its top end', () => {
    const { calls } = painted([{ id: 'a', ...RANGE, title: 'Volume' }], [axes()]);

    expect(calls.some(call => call.startsWith('fillText(Volume,'))).toBe(true);
  });

  it('write the labels of a scale in its own colour', () => {
    const { calls } = painted([{ id: 'a', ...RANGE, color: ORANGE }], [axes()]);

    expect(calls).toContain('fillStyle = rgba(255, 128, 0, 1)');
  });
});

describe('the legend on the 2D canvas', () => {
  it('writes the name of a series and its value in the corner of the pane', () => {
    const { calls } = painted([{ id: 'a', min: 0, max: 100 }], [legend()]);
    const written = calls
      .filter(call => call.startsWith('fillText('))
      .map(call => call.split(',')[0]);

    expect(written).toEqual(['fillText(Price', 'fillText(90']);
  });
});

describe('annotations on the 2D canvas', () => {
  const scales = [{ id: 'a', min: 0, max: 100 }];

  it('draw a dashed line across the pane at a level, labelled on its scale', () => {
    const { calls } = painted(scales, [annotations({ levels: [{ value: 50, label: 'limit' }] })]);

    expect(calls).toContain('setLineDash(6,6)');
    expect(calls).toContain('moveTo(10, 250)');
    expect(calls).toContain('lineTo(990, 250)');
    expect(calls.some(call => call.startsWith('fillText(limit'))).toBe(true);
  });

  it('label a level with its value when it has no label of its own', () => {
    const { calls } = painted(scales, [annotations({ levels: [{ value: 50 }] })]);

    expect(calls.some(call => call.startsWith('fillText(50'))).toBe(true);
  });

  it('draw nothing for a level outside the range of its scale', () => {
    const { calls } = painted(scales, [annotations({ levels: [{ value: 500 }] })]);

    expect(calls).not.toContain('setLineDash(6,6)');
  });

  it('put a badge with the letter of an event above the X axis, at its moment', () => {
    const { calls } = painted(scales, [annotations({ events: [{ x: 50, label: 'E' }] })]);

    expect(calls.some(call => call.startsWith('arc(500, '))).toBe(true);
    expect(calls.some(call => call.startsWith('fillText(E, 500'))).toBe(true);
  });

  it('draw no badge for an event outside the view', () => {
    const { calls } = painted(scales, [annotations({ events: [{ x: 500, label: 'E' }] })]);

    expect(calls.some(call => call.startsWith('fillText(E'))).toBe(false);
  });
});

describe('the crosshair on the 2D canvas with several scales', () => {
  it('labels the pointed height on every scale of the pane', () => {
    const { calls } = painted(
      [
        { id: 'a', min: 0, max: 100 },
        { id: 'b', side: 'right', min: 0, max: 1000 },
      ],
      [crosshair()],
      { x: 500, y: 250 }
    );
    const labels = calls
      .filter(call => call.startsWith('fillText('))
      .map(call => call.split(',')[0]);

    expect(labels).toEqual(['fillText(50', 'fillText(50', 'fillText(499']);
  });
});
