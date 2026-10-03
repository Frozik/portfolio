import { describe, expect, it } from 'vitest';

import { createChart } from '../../core/create-chart';
import { series } from '../../core/series/series';
import { timeDomain } from '../../core/viewport/time-domain';
import { timeseries } from '../../data/timeseries/timeseries';
import { LINE_MARK } from '../../marks/line/core';
import { createLineStyle } from '../../marks/line/style';
import { createFakeHost } from '../../testing/fake-host';
import { memorySource } from '../../testing/memory-timeseries-source';
import type { IFollowTailOptions } from './core';
import { followTail } from './core';

const SECOND = 1_000_000_000n;

async function settle(): Promise<void> {
  for (let turn = 0; turn < 5; turn += 1) {
    await Promise.resolve();
  }
}

/** A live chart showing the last hundred seconds of a series that ends at second 100. */
async function liveChart(options?: IFollowTailOptions) {
  const source = memorySource({
    points: Array.from({ length: 101 }, (_, index) => ({
      x: BigInt(index) * SECOND,
      value: index,
    })),
  });
  const chart = createChart({
    x: { domain: timeDomain(), start: 0n, end: 100n * SECOND },
    series: [series({ id: 'line', data: timeseries(source), style: createLineStyle(LINE_MARK) })],
    extensions: [followTail<bigint>({ glideMs: 0, ...options })],
  });
  chart.attach(createFakeHost({ width: 1000, height: 500, devicePixelRatio: 1 }));
  chart.prepareFrame(0);
  source.start(100n * SECOND);
  chart.prepareFrame(16);
  await settle();
  chart.prepareFrame(32);
  const push = (second: bigint): void =>
    source.push({ shape: 'point', points: [{ x: second * SECOND, value: 1 }] });
  return { chart, push };
}

describe('following the tail', () => {
  it('moves the view with the data while its right edge is at the last element', async () => {
    const { chart, push } = await liveChart();
    expect(chart.followTail.isFollowing).toBe(true);

    push(110n);
    chart.prepareFrame(48);

    expect(chart.viewport.x.current).toEqual({ start: 10n * SECOND, end: 110n * SECOND });
  });

  it('stays where the user went once they leave the end for history', async () => {
    const { chart, push } = await liveChart();
    chart.viewport.x.jump({ start: -50n * SECOND, end: 50n * SECOND });
    chart.prepareFrame(48);

    push(110n);
    chart.prepareFrame(64);

    expect(chart.followTail.isFollowing).toBe(false);
    expect(chart.viewport.x.current).toEqual({ start: -50n * SECOND, end: 50n * SECOND });
  });

  it('returns to the end and follows again on resume', async () => {
    const { chart, push } = await liveChart();
    chart.viewport.x.jump({ start: -50n * SECOND, end: 50n * SECOND });
    chart.prepareFrame(48);

    chart.followTail.resume();
    expect(chart.viewport.x.current.end).toBe(100n * SECOND);

    push(120n);
    chart.prepareFrame(64);
    expect(chart.viewport.x.current.end).toBe(120n * SECOND);
  });

  it('returns with the room it was told to keep to the right of the last element', async () => {
    const { chart, push } = await liveChart({ headroom: 0.1 });
    chart.viewport.x.jump({ start: -50n * SECOND, end: 50n * SECOND });
    chart.prepareFrame(48);

    chart.followTail.resume();
    expect(chart.viewport.x.current).toEqual({ start: 10n * SECOND, end: 110n * SECOND });

    push(120n);
    chart.prepareFrame(64);
    expect(chart.followTail.isFollowing).toBe(true);
    expect(chart.viewport.x.current.end).toBe(130n * SECOND);
  });
});

describe('following the tail with a glide', () => {
  const GLIDE = { glideMs: 400 };

  it('eases the view to the new element instead of jumping: half the way at half the time', async () => {
    const { chart, push } = await liveChart(GLIDE);

    push(110n);
    chart.prepareFrame(48);
    expect(chart.viewport.x.current.end).toBe(100n * SECOND);

    chart.prepareFrame(148);
    const early = chart.viewport.x.current.end;
    chart.prepareFrame(248);
    const halfway = chart.viewport.x.current.end;
    chart.prepareFrame(448);

    expect(early).toBeGreaterThan(100n * SECOND);
    expect(early - 100n * SECOND).toBeLessThan((halfway - 100n * SECOND) / 2n);
    expect(halfway).toBe(105n * SECOND);
    expect(chart.viewport.x.current).toEqual({ start: 10n * SECOND, end: 110n * SECOND });
  });

  it('counts as following all through the glide, though the edge is still behind', async () => {
    const { chart, push } = await liveChart(GLIDE);
    push(110n);
    chart.prepareFrame(48);

    chart.prepareFrame(148);

    expect(chart.followTail.isFollowing).toBe(true);
  });

  it('takes an element that arrives mid-glide into the same glide, and still lands exactly', async () => {
    const { chart, push } = await liveChart(GLIDE);
    push(110n);
    chart.prepareFrame(48);
    chart.prepareFrame(248);

    push(120n);
    chart.prepareFrame(264);
    chart.prepareFrame(664);

    expect(chart.viewport.x.current.end).toBe(120n * SECOND);
    expect(chart.followTail.isFollowing).toBe(true);
  });

  it('lets go at once when the user leaves for history mid-glide', async () => {
    const { chart, push } = await liveChart(GLIDE);
    push(110n);
    chart.prepareFrame(48);
    chart.prepareFrame(148);

    chart.viewport.x.jump({ start: -50n * SECOND, end: 50n * SECOND });
    chart.prepareFrame(248);
    chart.prepareFrame(448);

    expect(chart.followTail.isFollowing).toBe(false);
    expect(chart.viewport.x.current).toEqual({ start: -50n * SECOND, end: 50n * SECOND });
  });
});
