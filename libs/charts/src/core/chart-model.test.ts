import { describe, expect, it, vi } from 'vitest';

import { staticData } from '../data/static-data';
import { LINE_MARK } from '../marks/line/core';
import { createLineStyle } from '../marks/line/style';
import { createFakeHost } from '../testing/fake-host';
import type { TAnyExtension } from './chart-options';
import { createChart } from './create-chart';
import { defineExtension } from './kernel/define-extension';
import { series } from './series/series';
import type { ISeriesDataFactory } from './series/series-data';
import { defineStyle } from './series/style-processor';
import { numberDomain } from './viewport/number-domain';

const SIZE = { width: 800, height: 400, devicePixelRatio: 2 };
const points = staticData<number>({
  shape: 'point',
  points: [
    { x: 0, value: 10 },
    { x: 50, value: 30 },
    { x: 100, value: 20 },
  ],
});

function lineOver(data: ISeriesDataFactory<number>, id = 'line') {
  return series({ id, data, style: createLineStyle<number>(LINE_MARK) });
}

function mounted<const TExtensions extends readonly TAnyExtension<number>[]>(
  extensions: TExtensions,
  data: ISeriesDataFactory<number> = points
) {
  const chart = createChart({
    x: { domain: numberDomain, start: 0, end: 100 },
    series: [lineOver(data)],
    extensions,
  });
  const host = createFakeHost(SIZE);
  chart.attach(host);
  return { chart, host };
}

describe('a chart', () => {
  it('builds no frame until it is mounted, and none while it has no size', () => {
    const chart = createChart({
      x: { domain: numberDomain, start: 0, end: 100 },
      series: [lineOver(points)],
      extensions: [],
    });
    expect(chart.prepareFrame(0)).toBeUndefined();

    chart.attach(createFakeHost({ width: 0, height: 0, devicePixelRatio: 1 }));
    expect(chart.prepareFrame(16)).toBeUndefined();
  });

  it('builds no frame when there is nothing to draw and nothing loading', () => {
    const { chart } = mounted([], staticData<number>({ shape: 'point', points: [] }));

    expect(chart.prepareFrame(0)).toBeUndefined();
  });

  it('lays the plot inside the theme margin, in device pixels', () => {
    const { chart } = mounted([]);

    const frame = chart.prepareFrame(0);

    expect(frame?.plot).toEqual({
      left: 20,
      top: 20,
      width: 760,
      height: 360,
      right: 780,
      bottom: 380,
    });
    expect(frame?.xSpan).toBe(100);
  });

  it('hands painters the same frame for as long as nothing in it changed', () => {
    const { chart, host } = mounted([]);
    const first = chart.prepareFrame(0);

    expect(chart.prepareFrame(16)).toBe(first);

    chart.viewport.x.jump({ start: 10, end: 60 });
    const moved = chart.prepareFrame(32);
    expect(moved).not.toBe(first);

    host.resize({ ...SIZE, width: 1000 });
    expect(chart.prepareFrame(48)).not.toBe(moved);
  });

  it('exposes the slice of each extension under its id', () => {
    const counter = defineExtension<number, 'counter', { readonly value: number }>('counter', {
      slice: { value: 7 },
    });

    const { chart } = mounted([counter]);

    expect(chart.counter.value).toBe(7);
    expect(chart.extension('counter')).toBe(chart.counter);
  });

  it('refuses an extension whose requirement was not registered before it', () => {
    const dependent = defineExtension<number, 'dependent'>('dependent', {}, ['ticks']);

    expect(() => mounted([dependent])).toThrow(/requires "ticks"/);
  });

  it('lets extensions narrow every X range that is written', () => {
    const firstHundred = defineExtension<number, 'bounds'>('bounds', {
      constrainX: range => ({ start: Math.max(0, range.start), end: Math.min(100, range.end) }),
    });
    const { chart } = mounted([firstHundred]);

    chart.viewport.x.jump({ start: -50, end: 500 });

    expect(chart.viewport.x.current).toEqual({ start: 0, end: 100 });
  });

  it('draws the target at once without an animator and lets an animator approach it', () => {
    const { chart } = mounted([]);
    chart.viewport.x.setTarget({ start: 40, end: 80 });
    expect(chart.prepareFrame(0)?.x).toEqual({ start: 40, end: 80 });

    const halfway = defineExtension<number, 'halfway'>('halfway', {
      animate: (domain, current, target) => ({
        start: domain.add(current.start, domain.diff(target.start, current.start) / 2),
        end: domain.add(current.end, domain.diff(target.end, current.end) / 2),
      }),
    });
    const animated = mounted([halfway]).chart;
    animated.viewport.x.setTarget({ start: 40, end: 80 });

    expect(animated.prepareFrame(0)?.x).toEqual({ start: 20, end: 90 });
  });

  it('fits the value axis with what an extension makes of the visible data', () => {
    const fit = defineExtension<number, 'fit'>('fit', {
      fitY: visible => ({ start: -1, end: visible.series.length }),
    });
    const { chart } = mounted([fit]);

    expect(chart.viewport.scale('main').current).toEqual({ start: 0, end: 1 });
    chart.prepareFrame(0);

    expect(chart.viewport.scale('main').current).toEqual({ start: -1, end: 1 });
  });

  it('adds the room extensions take to the margin', () => {
    const axisRoom = defineExtension<number, 'room'>('room', {
      insets: () => ({ left: 40, top: 0, right: 0, bottom: 0 }),
    });
    const { chart } = mounted([axisRoom]);

    expect(chart.prepareFrame(0)?.plot.left).toBe(100);
  });

  it('gives extensions the host while mounted and takes it back on detach', () => {
    const unmount = vi.fn();
    const mount = vi.fn(() => unmount);
    const { chart } = mounted([defineExtension<number, 'mounting'>('mounting', { mount })]);

    expect(mount).toHaveBeenCalledTimes(1);
    chart.detach();
    expect(unmount).toHaveBeenCalledTimes(1);
  });
});

describe('the series of a chart', () => {
  it('share one data instance when they name the same description', () => {
    const create = vi.fn(points.create);
    const shared: ISeriesDataFactory<number> = { create };

    createChart({
      x: { domain: numberDomain, start: 0, end: 100 },
      series: [lineOver(shared, 'first'), lineOver(shared, 'second')],
      extensions: [],
    });

    expect(create).toHaveBeenCalledTimes(1);
  });

  it('are styled once per run and again when the series is given another style', () => {
    const { chart } = mounted([]);
    const first = chart.prepareFrame(0);
    expect(first?.series[0].runs[0].styleRevision).toBe(0);

    chart.series.setStyle('line', createLineStyle<number>(LINE_MARK, { size: 4 }));
    const restyled = chart.prepareFrame(16);

    expect(restyled?.series[0].runs[0].styleRevision).toBe(1);
    expect(restyled?.series[0].runs[0].style.fill.size).toBe(4);
    expect(restyled?.series[0].runs[0].run).toBe(first?.series[0].runs[0].run);
  });

  it('styles every run anew when the theme changes, for styles read their colours from it', () => {
    const themed = defineStyle<number, 'point'>({
      shape: 'point',
      elementWidth: 1,
      elementGap: 0,
      style: (_run, { theme }) => ({
        marks: [{ mark: LINE_MARK }],
        fill: { color: theme.grid, size: 1 },
        stroke: { color: 0, size: 0 },
      }),
    });
    const chart = createChart({
      x: { domain: numberDomain, start: 0, end: 100 },
      series: [series({ id: 'line', data: points, style: themed })],
      extensions: [],
    });
    chart.attach(createFakeHost(SIZE));
    const before = chart.prepareFrame(0)?.series[0].runs[0];

    chart.setTheme({ ...chart.theme, grid: 0xff0000ff });
    const after = chart.prepareFrame(16)?.series[0].runs[0];

    expect(after?.style.fill.color).toBe(0xff0000ff);
    expect(after?.styleRevision).toBeGreaterThan(before?.styleRevision ?? 0);
  });

  it('shows no more of an axis than the axis allows, shortening round the middle', () => {
    const chart = createChart({
      x: { domain: { ...numberDomain, maxSpan: 1000 }, start: 0, end: 100 },
      series: [lineOver(points)],
      extensions: [],
    });

    chart.viewport.x.setTarget({ start: -2000, end: 4000 });

    expect(chart.viewport.x.target).toEqual({ start: 500, end: 1500 });
  });

  it('refuse to draw when a mark cannot draw the shape it was given', () => {
    const candlesOnly = { ...LINE_MARK, id: 'candle-only', shapes: ['candle' as const] };
    const chart = createChart({
      x: { domain: numberDomain, start: 0, end: 100 },
      series: [series({ id: 'bad', data: points, style: createLineStyle<number>(candlesOnly) })],
      extensions: [],
    });
    chart.attach(createFakeHost(SIZE));

    expect(() => chart.prepareFrame(0)).toThrow(/cannot be drawn from point data/);
  });
});
