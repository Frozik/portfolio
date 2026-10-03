import { assert } from '@frozik/utils/assert/assert';
import { isNil } from 'lodash-es';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mainScaleOf } from '../../core/frame/chart-frame';
import type { IPointerInput, TPointerKind } from '../../core/host/pointer-source';
import { mountLineChart } from '../../testing/line-chart';
import { panZoom } from '../pan-zoom/core';
import { ticks } from '../ticks/core';
import { linearTicks } from '../ticks/linear-ticks';
import { crosshairCore } from './core';

const HOLD_MS = 300;

function input(
  phase: IPointerInput['phase'],
  x: number,
  y: number,
  kind: TPointerKind = 'mouse',
  pointerId = 1
): IPointerInput {
  return { phase, pointerId, kind, x, y, timeStamp: 0, shiftKey: false };
}

function scene() {
  const { chart, host } = mountLineChart([ticks({ x: linearTicks() }), crosshairCore(), panZoom()]);
  const frame = chart.prepareFrame(0);
  assert(!isNil(frame), 'the chart has something to draw');
  return { chart, host, frame };
}

describe('crosshair', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('follows the mouse and names what it points at on both axes', () => {
    const { chart, host, frame } = scene();

    host.pointer.feed(input('move', 500, 250));
    const crosshair = chart.crosshair.crosshairOf(frame);

    assert(!isNil(crosshair), 'the pointer is over the plot');
    expect(crosshair.x).toBeCloseTo(50, 0);
    const { min, max } = mainScaleOf(frame);
    expect(crosshair.value).toBeCloseTo((min + max) / 2, 0);
    expect(crosshair.xLabel).not.toBe('');
    expect(crosshair.valueLabel).not.toBe('');
    expect(chart.crosshair.point?.x).toBe(crosshair.x);
  });

  it('disappears when the mouse leaves the chart', () => {
    const { chart, host, frame } = scene();
    host.pointer.feed(input('move', 500, 250));

    host.pointer.feed(input('leave', 500, 250));

    expect(chart.crosshair.position).toBeUndefined();
    expect(chart.crosshair.crosshairOf(frame)).toBeUndefined();
  });

  it('is not drawn while the pointer is over the margin round the plot', () => {
    const { chart, host, frame } = scene();

    host.pointer.feed(input('move', 2, 250));

    expect(chart.crosshair.crosshairOf(frame)).toBeUndefined();
  });

  it('leaves a moving finger to the pan', () => {
    const { chart, host } = scene();

    host.pointer.feed(input('down', 500, 250, 'touch'));
    host.pointer.feed(input('move', 600, 250, 'touch'));

    expect(chart.crosshair.position).toBeUndefined();
    expect(chart.viewport.x.current).toEqual({ start: -10, end: 90 });
  });

  it('takes a finger that rested for a moment, and its moves no longer pan', () => {
    const { chart, host } = scene();

    host.pointer.feed(input('down', 500, 250, 'touch'));
    vi.advanceTimersByTime(HOLD_MS);
    host.pointer.feed(input('move', 600, 260, 'touch'));

    expect(chart.crosshair.position).toMatchObject({ x: 600, y: 260 });
    expect(chart.viewport.x.current).toEqual({ start: 0, end: 100 });

    host.pointer.feed(input('up', 600, 260, 'touch'));
    expect(chart.crosshair.position).toBeUndefined();
  });

  it('gives the gesture back when a second finger lands', () => {
    const { chart, host } = scene();
    host.pointer.feed(input('down', 500, 250, 'touch', 1));
    vi.advanceTimersByTime(HOLD_MS);

    host.pointer.feed(input('down', 700, 250, 'touch', 2));

    expect(chart.crosshair.position).toBeUndefined();
  });
});
