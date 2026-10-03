import { describe, expect, it } from 'vitest';

import type { IPointerInput } from '../../core/host/pointer-source';
import { mountLineChart } from '../../testing/line-chart';
import { panZoom } from './core';

function pointer(
  phase: IPointerInput['phase'],
  x: number,
  timeStamp = 0,
  pointerId = 1
): IPointerInput {
  return { phase, pointerId, kind: 'mouse', shiftKey: false, x, y: 100, timeStamp };
}

function panning() {
  const { chart, host } = mountLineChart([panZoom()]);
  chart.prepareFrame(0);
  return { chart, host, viewport: chart.viewport };
}

describe('pan and zoom', () => {
  it('drags the chart with the pointer: a tenth of the width is a tenth of the range', () => {
    const { host, viewport } = panning();

    host.pointer.feed(pointer('down', 500));
    host.pointer.feed(pointer('move', 600));

    expect(viewport.current).toEqual({ start: -10, end: 90 });
    expect(viewport.target).toEqual({ start: -10, end: 90 });
  });

  it('shows a grabbing hand while the chart is held', () => {
    const { host } = panning();
    expect(host.pointer.cursor).toBe('crosshair');

    host.pointer.feed(pointer('down', 500));
    expect(host.pointer.cursor).toBe('grabbing');

    host.pointer.feed(pointer('up', 500));
    expect(host.pointer.cursor).toBe('crosshair');
  });

  it('zooms the target in round the cursor on a wheel turn towards the chart', () => {
    const { host, viewport } = panning();

    host.pointer.wheel({ x: 250, y: 100, deltaY: -1, shiftKey: false });

    expect(viewport.target.start).toBeCloseTo(7.5);
    expect(viewport.target.end).toBeCloseTo(77.5);
  });

  it('zooms out on a wheel turn away from the chart', () => {
    const { host, viewport } = panning();

    host.pointer.wheel({ x: 500, y: 100, deltaY: 1, shiftKey: false });

    expect(viewport.target.start).toBeCloseTo(-15);
    expect(viewport.target.end).toBeCloseTo(115);
  });

  it('keeps coasting after a flick and slows to a stop', () => {
    const { chart, host, viewport } = panning();

    host.pointer.feed(pointer('down', 500, 0));
    host.pointer.feed(pointer('move', 520, 10));
    host.pointer.feed(pointer('move', 540, 20));
    host.pointer.feed(pointer('up', 540, 20));
    const released = viewport.current.start;

    chart.prepareFrame(36);
    const coasted = viewport.current.start;
    expect(coasted).toBeLessThan(released);

    for (let now = 52; now < 10_000; now += 16) {
      chart.prepareFrame(now);
    }
    const rested = viewport.current.start;
    chart.prepareFrame(10_016);
    expect(viewport.current.start).toBe(rested);
    expect(rested).toBeLessThan(coasted);
  });

  it('does not coast after a pointer that stopped before it lifted', () => {
    const { chart, host, viewport } = panning();

    host.pointer.feed(pointer('down', 500, 0));
    host.pointer.feed(pointer('move', 540, 10));
    host.pointer.feed(pointer('cancel', 540, 20));
    const released = viewport.current.start;
    chart.prepareFrame(36);

    expect(viewport.current.start).toBe(released);
  });

  it('does not coast when the pointer rested before it lifted, however fast it moved earlier', () => {
    const { chart, host, viewport } = panning();

    host.pointer.feed(pointer('down', 500, 0));
    host.pointer.feed(pointer('move', 520, 10));
    host.pointer.feed(pointer('move', 540, 20));
    host.pointer.feed(pointer('up', 540, 2020));
    const released = viewport.current.start;
    chart.prepareFrame(2036);

    expect(viewport.current.start).toBe(released);
  });

  it('coasts from the moment of release: the first frame moves by one frame of travel', () => {
    const { chart, host, viewport } = panning();

    host.pointer.feed(pointer('down', 500, 0));
    host.pointer.feed(pointer('move', 520, 10));
    host.pointer.feed(pointer('move', 540, 20));
    host.pointer.feed(pointer('up', 540, 30));
    const released = viewport.current.start;
    chart.prepareFrame(46);

    expect(released - viewport.current.start).toBeCloseTo(3.2);
  });

  it('zooms in when two pointers move apart', () => {
    const { host, viewport } = panning();

    host.pointer.feed(pointer('down', 400, 0, 1));
    host.pointer.feed(pointer('down', 600, 0, 2));
    host.pointer.feed(pointer('move', 300, 10, 1));
    host.pointer.feed(pointer('move', 700, 10, 2));

    const span = viewport.target.end - viewport.target.start;
    expect(span).toBeLessThan(100);
    expect(viewport.target.start).toBeGreaterThan(0);
    expect(viewport.target.end).toBeLessThan(100);
  });

  it('pans by the middle of two pointers moving together', () => {
    const { host, viewport } = panning();

    host.pointer.feed(pointer('down', 400, 0, 1));
    host.pointer.feed(pointer('down', 600, 0, 2));
    host.pointer.feed(pointer('move', 500, 10, 1));
    host.pointer.feed(pointer('move', 700, 10, 2));

    expect(viewport.current).toEqual({ start: -10, end: 90 });
  });

  it('leaves the X axis alone when two pointers spread straight up and down', () => {
    const { host, viewport } = panning();

    host.pointer.feed(pointer('down', 500, 0, 1));
    host.pointer.feed(pointer('down', 500, 0, 2));
    host.pointer.feed(pointer('move', 500, 10, 1));

    expect(viewport.current).toEqual({ start: 0, end: 100 });
    expect(viewport.target).toEqual({ start: 0, end: 100 });
  });

  it('stops listening once the chart is taken off its host', () => {
    const { chart, host, viewport } = panning();
    chart.detach();

    host.pointer.feed(pointer('down', 500));
    host.pointer.feed(pointer('move', 600));

    expect(viewport.current).toEqual({ start: 0, end: 100 });
  });
});
