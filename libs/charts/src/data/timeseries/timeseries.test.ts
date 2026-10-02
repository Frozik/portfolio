import { describe, expect, it } from 'vitest';

import { columnsOf } from '../../core/series/columns';
import { ChartDataError } from '../../core/series/data-error';
import type { IDataNeed, ISeriesData } from '../../core/series/series-data';
import type { IPoint, TShape } from '../../core/series/shape';
import { memoryPersistentCache } from '../../testing/memory-persistent-cache';
import type { IMemorySource } from '../../testing/memory-timeseries-source';
import { memorySource } from '../../testing/memory-timeseries-source';
import { timeDomain } from './time-domain';
import { TIME_SCALE } from './time-scale';
import type { ITimeseriesOptions } from './timeseries';
import { timeseries } from './timeseries';

const SECOND = 1_000_000_000n;
const WIDTH = 1000;

/** One point a second for a thousand seconds. */
const HISTORY: readonly IPoint[] = Array.from({ length: 1000 }, (_, index) => ({
  x: BigInt(index) * SECOND,
  value: index,
}));

function need(
  startSeconds: number,
  endSeconds: number,
  shape: TShape = 'point',
  widthPx = WIDTH
): IDataNeed<bigint> {
  return {
    range: { start: BigInt(startSeconds) * SECOND, end: BigInt(endSeconds) * SECOND },
    shape,
    pixelsPerElement: 1,
    widthPx,
  };
}

/** A chart so narrow that a request brings 256 elements: less than the history holds. */
const NARROW = 100;
const SECONDS_PER_NARROW_PIXEL = 1;
function narrow(startSeconds: number): IDataNeed<bigint> {
  return need(startSeconds, startSeconds + NARROW * SECONDS_PER_NARROW_PIXEL, 'point', NARROW);
}

async function settle(): Promise<void> {
  for (let turn = 0; turn < 5; turn += 1) {
    await Promise.resolve();
  }
}

function opened(source: IMemorySource, options: ITimeseriesOptions = {}): ISeriesData<bigint> {
  const data = timeseries(source, options).create({ domain: timeDomain });
  data.activate();
  return data;
}

/** Another frame, and time for what it started to finish. */
async function frame(data: ISeriesData<bigint>, wanted: IDataNeed<bigint>): Promise<void> {
  data.prepare([wanted]);
  await settle();
}

/** Shows a range once the live edge is known, and waits for the answers. */
async function shown(
  source: IMemorySource,
  data: ISeriesData<bigint>,
  wanted: IDataNeed<bigint>,
  since = 999n * SECOND
): Promise<void> {
  data.prepare([wanted]);
  source.start(since);
  data.prepare([wanted]);
  await settle();
}

function timesOf(data: ISeriesData<bigint>, wanted: IDataNeed<bigint>): readonly bigint[] {
  return data.runs(wanted).flatMap(run => Array.from(run.x).slice(0, run.length));
}

describe('a time series', () => {
  it('asks for nothing until its subscription says where the live edge is', async () => {
    const source = memorySource({ points: HISTORY });
    const data = opened(source);

    data.prepare([need(900, 1000)]);
    await settle();

    expect(source.subscriptions).toHaveLength(1);
    expect(source.requests).toHaveLength(0);
    expect(data.loading).toEqual([need(900, 1000).range]);
  });

  it('reads history backward up to the moment the subscription started, that moment included', async () => {
    const source = memorySource({ points: HISTORY });
    const data = opened(source);

    await shown(source, data, need(900, 1000));

    expect(source.requests).toHaveLength(1);
    expect(source.requests[0]).toMatchObject({
      from: undefined,
      to: 999n * SECOND,
      includeTo: true,
      direction: 'backward',
      shape: 'point',
      scale: TIME_SCALE.milliseconds100,
    });
    expect(timesOf(data, need(900, 1000)).at(-1)).toBe(999n * SECOND);
    expect(data.loading).toEqual([]);
  });

  it('asks once for what it shows and not again while it has it', async () => {
    const source = memorySource({ points: HISTORY });
    const data = opened(source);
    await shown(source, data, need(900, 1000));

    data.prepare([need(900, 1000)]);
    data.prepare([need(950, 990)]);
    await settle();

    expect(source.requests).toHaveLength(1);
  });

  it('continues a cut answer from the time it stopped on, without that time', async () => {
    const source = memorySource({ points: HISTORY });
    const data = opened(source);
    await shown(source, data, narrow(900));
    const firstKnown = timesOf(data, narrow(900))[0];
    expect(firstKnown).toBe(744n * SECOND);

    data.prepare([narrow(700)]);
    await settle();

    expect(source.requests).toHaveLength(2);
    expect(source.requests[1]).toMatchObject({
      from: undefined,
      to: firstKnown - 1n,
      includeTo: true,
      direction: 'backward',
    });
    const times = timesOf(data, narrow(700));
    expect(times[0]).toBeLessThan(700n * SECOND);
    expect(data.runs(narrow(700))).toHaveLength(1);
    expect(new Set(times).size).toBe(times.length);
    expect(times).toEqual([...times].sort((first, second) => (first < second ? -1 : 1)));
  });

  it('knows the beginning of history once an answer comes short of the limit', async () => {
    const source = memorySource({ points: HISTORY.slice(0, 50) });
    const data = opened(source);

    await shown(source, data, need(0, 100), 49n * SECOND);

    expect(data.extent).toEqual({ start: 0n, end: 49n * SECOND });
    data.prepare([need(-500, 100)]);
    await settle();
    expect(source.requests).toHaveLength(1);
  });

  it('appends what the subscription brings to the run it already shows', async () => {
    const source = memorySource({ points: HISTORY });
    const data = opened(source);
    await shown(source, data, need(900, 1100));
    const [before] = data.runs(need(900, 1100));

    source.push({ shape: 'point', points: [{ x: 1000n * SECOND, value: 5 }] });
    const [after] = data.runs(need(900, 1100));

    expect(after.id).toBe(before.id);
    expect(after.revision).toBeGreaterThan(before.revision);
    expect(after.length).toBe(before.length + 1);
    expect(data.extent.end).toBe(1000n * SECOND);
    expect(source.requests).toHaveLength(1);
  });

  it('tells its listeners what changed', async () => {
    const source = memorySource({ points: HISTORY });
    const data = opened(source);
    const changed: unknown[] = [];
    data.subscribe({ changed: range => changed.push(range), failed: () => {} });
    await shown(source, data, need(900, 1100));
    changed.length = 0;

    source.push({ shape: 'point', points: [{ x: 1000n * SECOND, value: 5 }] });

    expect(changed).toEqual([{ start: 1000n * SECOND, end: 1000n * SECOND }]);
  });

  it('shows the element still being formed as a run of its own that changes in place', async () => {
    const source = memorySource({ points: HISTORY });
    const data = opened(source);
    await shown(source, data, need(900, 1100));

    source.pending({ x: 1000n * SECOND, value: 1 });
    const first = data.runs(need(900, 1100)).at(-1);
    source.pending({ x: 1000n * SECOND, value: 2 });
    const second = data.runs(need(900, 1100)).at(-1);

    expect(data.runs(need(900, 1100))).toHaveLength(2);
    expect(second?.id).toBe(first?.id);
    expect(second?.revision).toBeGreaterThan(first?.revision ?? 0);
    expect(data.extent.end).toBe(1000n * SECOND);

    source.pending(undefined);
    expect(data.runs(need(900, 1100))).toHaveLength(1);
  });

  it('moves to another scale on zoom: a new subscription, the old one closed', async () => {
    const source = memorySource({ points: HISTORY });
    const data = opened(source);
    await shown(source, data, need(900, 1000));
    const [fine] = source.subscriptions;

    data.prepare([need(0, 100_000)]);

    expect(source.subscriptions).toHaveLength(1);
    expect(source.subscriptions[0]).not.toBe(fine);
    expect(Number(source.subscriptions[0].scale)).toBeGreaterThan(Number(fine.scale));
  });

  it('keeps what a scale knew and asks only for what came since', async () => {
    const source = memorySource({ points: HISTORY });
    const data = opened(source);
    await shown(source, data, need(900, 1000));
    data.prepare([need(0, 100_000)]);
    source.push({ shape: 'point', points: [{ x: 1000n * SECOND, value: 5 }] });

    data.prepare([need(901, 1001)]);
    source.start(1000n * SECOND);
    data.prepare([need(901, 1001)]);
    await settle();

    const refill = source.requests.filter(request => request.scale === TIME_SCALE.milliseconds100);
    expect(refill).toHaveLength(2);
    expect(refill[1]).toMatchObject({
      from: 999n * SECOND,
      includeFrom: false,
      direction: 'forward',
    });
    expect(timesOf(data, need(901, 1001)).at(-1)).toBe(1000n * SECOND);
  });

  it('asks again for the last moment delivered when the subscription restarts', async () => {
    const source = memorySource({ points: HISTORY });
    const data = opened(source);
    await shown(source, data, need(900, 1100));
    source.push({ shape: 'point', points: [{ x: 1000n * SECOND, value: 5 }] });
    source.push({ shape: 'point', points: [{ x: 1005n * SECOND, value: 6 }] });

    source.start(1010n * SECOND);
    data.prepare([need(900, 1100)]);
    await settle();

    expect(source.requests.at(-1)).toMatchObject({
      from: 1005n * SECOND - 1n,
      includeFrom: false,
      to: 1010n * SECOND,
    });
    const times = timesOf(data, need(900, 1100));
    expect(times.filter(time => time === 1005n * SECOND)).toHaveLength(1);
  });

  it('marks a scale the source does not have as failed and stops asking', async () => {
    const source = memorySource({ points: HISTORY, scales: [TIME_SCALE.days1] });
    const data = opened(source, { scales: [TIME_SCALE.seconds1] });
    const failures: unknown[] = [];
    data.subscribe({ changed: () => {}, failed: failure => failures.push(failure.error.code) });

    await shown(source, data, need(900, 1000));
    data.prepare([need(900, 1000)]);
    data.prepare([need(800, 1000)]);
    await settle();

    expect(source.requests).toHaveLength(1);
    expect(failures).toEqual(['NOT_FOUND']);
    expect(data.failed.map(failure => failure.error.code)).toEqual(['NOT_FOUND']);
    expect(source.subscriptions).toHaveLength(0);
  });

  it('asks again for a failed range only when told to retry', async () => {
    const source = memorySource({ points: HISTORY });
    const data = opened(source);
    source.failWith = new ChartDataError('INTERNAL', 'broken');
    await shown(source, data, need(900, 1000));
    data.prepare([need(900, 1000)]);
    await settle();
    expect(source.requests).toHaveLength(1);
    expect(data.failed).toHaveLength(1);

    source.failWith = undefined;
    data.retry(need(900, 1000).range);
    data.prepare([need(900, 1000)]);
    await settle();

    expect(source.requests).toHaveLength(2);
    expect(data.failed).toEqual([]);
    expect(timesOf(data, need(900, 1000)).length).toBeGreaterThan(0);
  });

  it('retries a transient failure by itself after a pause, when retries are on', async () => {
    let now = 0;
    const source = memorySource({ points: HISTORY });
    const data = opened(source, { retry: { delayMs: 100, maxDelayMs: 1000 }, now: () => now });
    source.failWith = new ChartDataError('UNAVAILABLE', 'down');
    await shown(source, data, need(900, 1000));
    source.failWith = undefined;

    now = 50;
    data.prepare([need(900, 1000)]);
    await settle();
    expect(source.requests).toHaveLength(1);

    now = 150;
    data.prepare([need(900, 1000)]);
    await settle();
    expect(source.requests).toHaveLength(2);
    expect(data.failed).toEqual([]);
  });

  it('takes an answer of another shape for a broken source', async () => {
    const source = memorySource({ points: HISTORY });
    source.fetch = async () => ({ shape: 'candle', candles: [] });
    const data = opened(source);

    await shown(source, data, need(900, 1000));

    expect(data.failed.map(failure => failure.error.code)).toEqual(['INTERNAL']);
  });

  it('serves candles and points of one series from separate requests', async () => {
    const source = memorySource({
      points: HISTORY,
      candles: HISTORY.map(point => ({
        x: point.x,
        open: point.value,
        min: point.value - 1,
        max: point.value + 1,
        close: point.value,
      })),
    });
    const data = opened(source);
    const both = [need(900, 1000), need(900, 1000, 'candle')];

    data.prepare(both);
    source.start(999n * SECOND);
    data.prepare(both);
    await settle();

    expect(source.requests.map(request => request.shape).sort()).toEqual(['candle', 'point']);
    expect(data.runs(both[0])[0].shape).toBe('point');
    expect(data.runs(both[1])[0].shape).toBe('candle');
  });

  it('closes its subscriptions and cancels its requests when the chart leaves the stage', async () => {
    const source = memorySource({ points: HISTORY });
    const data = opened(source);
    data.prepare([need(900, 1000)]);
    source.start(999n * SECOND);
    data.prepare([need(900, 1000)]);

    data.suspend();
    await settle();

    expect(source.subscriptions).toHaveLength(0);
    expect(source.requests[0].signal.aborted).toBe(true);
    expect(data.runs(need(900, 1000))).toEqual([]);
  });

  it('forgets the scales no longer shown when memory runs short, never what is on screen', async () => {
    const source = memorySource({ points: HISTORY });
    const data = opened(source, { cache: { memory: { maxElements: 10 } } });
    await shown(source, data, need(900, 1000));
    const fine = timesOf(data, need(900, 1000)).length;

    data.prepare([need(0, 100_000)]);
    source.start(999n * SECOND);
    data.prepare([need(0, 100_000)]);
    await settle();
    data.prepare([need(0, 100_000)]);

    expect(fine).toBeGreaterThan(10);
    expect(timesOf(data, need(0, 100_000)).length).toBeGreaterThan(10);
    data.prepare([need(900, 1000)]);
    expect(timesOf(data, need(900, 1000))).toEqual([]);
  });
});

describe('a time series over a range with no elements', () => {
  it('remembers the range as known and empty', async () => {
    const source = memorySource({ points: [] });
    const data = opened(source);

    await shown(source, data, need(900, 1000));
    data.prepare([need(900, 1000)]);
    await settle();

    expect(source.requests).toHaveLength(1);
    expect(data.failed).toEqual([]);
    expect(data.loading).toEqual([]);
    expect(data.runs(need(900, 1000))).toEqual([]);
  });
});

describe('a time series with a persistent cache', () => {
  const KEY = 'series|point|100000000';

  it('keeps what it reads from the source under the name of the series, shape and scale', async () => {
    const cache = memoryPersistentCache();
    const source = memorySource({ points: HISTORY });
    const data = opened(source, { key: 'series', cache: { persistent: cache } });

    await shown(source, data, need(900, 1000));
    await frame(data, need(900, 1000));

    const [segment] = cache.stored.get(KEY) ?? [];
    expect(segment.end).toBe(999n * SECOND);
    expect(segment.columns.length).toBe(1000);
  });

  it('shows what was kept without asking the source, and asks it only for the rest', async () => {
    const cache = memoryPersistentCache();
    const first = memorySource({ points: HISTORY });
    const earlier = opened(first, { key: 'series', cache: { persistent: cache } });
    await shown(first, earlier, narrow(900));
    await frame(earlier, narrow(900));

    const source = memorySource({ points: HISTORY });
    const data = opened(source, { key: 'series', cache: { persistent: cache } });
    await shown(source, data, narrow(900));
    await frame(data, narrow(900));

    expect(timesOf(data, narrow(900))[0]).toBe(900n * SECOND);
    expect(source.requests).toHaveLength(0);

    await frame(data, narrow(700));
    await frame(data, narrow(700));
    expect(source.requests).toHaveLength(1);
    expect(source.requests[0]).toMatchObject({ to: 744n * SECOND - 1n });
    expect(timesOf(data, narrow(700))[0]).toBeLessThan(700n * SECOND);
  });

  it('keeps what the subscription delivered once the live segment closes', async () => {
    const cache = memoryPersistentCache();
    const source = memorySource({ points: HISTORY });
    const data = opened(source, { key: 'series', cache: { persistent: cache } });
    await shown(source, data, need(900, 1000));
    await frame(data, need(900, 1000));
    source.push({ shape: 'point', points: [{ x: 1000n * SECOND, value: 1 }] });
    source.push({ shape: 'point', points: [{ x: 1001n * SECOND, value: 2 }] });

    data.suspend();

    const live = (cache.stored.get(KEY) ?? []).at(-1);
    expect(live).toMatchObject({ start: 999n * SECOND + 1n, end: 1001n * SECOND - 1n });
    expect(live?.columns.length).toBe(1);
  });

  it('keeps nothing without a name for the series', async () => {
    const cache = memoryPersistentCache();
    const source = memorySource({ points: HISTORY });

    const data = opened(source, { cache: { persistent: cache } });
    await shown(source, data, need(900, 1000));
    await frame(data, need(900, 1000));

    expect(source.requests).toHaveLength(1);
    expect(cache.stored.size).toBe(0);
    expect(cache.reads).toEqual([]);
  });
});

describe('a time series whose subscription ends for good', () => {
  it('keeps the subscription through a transient error, and marks the live edge as stalled', async () => {
    const source = memorySource({ points: HISTORY });
    const data = opened(source);
    const failures: string[] = [];
    data.subscribe({ changed: () => {}, failed: failure => failures.push(failure.error.code) });
    await shown(source, data, need(900, 1100));

    source.error(new ChartDataError('UNAVAILABLE', 'reconnecting'));

    expect(source.subscriptions).toHaveLength(1);
    expect(failures).toEqual(['UNAVAILABLE']);
    expect(data.failed.map(failure => failure.error.code)).toEqual(['UNAVAILABLE']);
    expect(data.failed[0].range.start).toBe(999n * SECOND);
    expect(timesOf(data, need(900, 1100)).length).toBeGreaterThan(0);
  });

  it('tells of a stalled live edge wherever the view is', async () => {
    const source = memorySource({ points: HISTORY });
    const data = opened(source);
    await shown(source, data, need(900, 1000));

    source.error(new ChartDataError('UNAVAILABLE', 'reconnecting'));
    await frame(data, need(100, 200));

    expect(data.failed.map(failure => failure.error.code)).toEqual(['UNAVAILABLE']);
  });

  it('takes the mark off once the source is back', async () => {
    const source = memorySource({ points: HISTORY });
    const data = opened(source);
    await shown(source, data, need(900, 1100));
    source.error(new ChartDataError('UNAVAILABLE', 'reconnecting'));

    source.start(1005n * SECOND);

    expect(data.failed).toEqual([]);
  });

  it('says so once, however many times the source repeats that it is down', async () => {
    const source = memorySource({ points: HISTORY });
    const data = opened(source);
    const failures: string[] = [];
    data.subscribe({ changed: () => {}, failed: failure => failures.push(failure.error.code) });
    await shown(source, data, need(900, 1100));

    source.error(new ChartDataError('UNAVAILABLE', 'reconnecting'));
    source.error(new ChartDataError('UNAVAILABLE', 'reconnecting'));

    expect(failures).toEqual(['UNAVAILABLE']);
    expect(data.failed).toHaveLength(1);
  });

  it('keeps showing history, marks the lost live edge, and asks for it again only on retry', async () => {
    const source = memorySource({ points: HISTORY });
    const data = opened(source);
    const failures: string[] = [];
    data.subscribe({ changed: () => {}, failed: failure => failures.push(failure.error.code) });
    await shown(source, data, need(900, 1100));

    source.error(new ChartDataError('PERMISSION_DENIED', 'no'));
    await frame(data, need(900, 1100));

    expect(failures).toEqual(['PERMISSION_DENIED']);
    expect(source.subscriptions).toHaveLength(0);
    expect(data.failed.map(failure => failure.error.code)).toEqual(['PERMISSION_DENIED']);
    expect(data.failed[0].range.start).toBe(999n * SECOND);
    expect(timesOf(data, need(900, 1100)).length).toBeGreaterThan(0);

    data.retry(need(900, 1100).range);
    data.prepare([need(900, 1100)]);
    expect(source.subscriptions).toHaveLength(1);
    expect(data.failed).toEqual([]);
  });
});

describe('a time series and the code a request failed with', () => {
  const PERMANENT = [
    'INVALID_ARGUMENT',
    'OUT_OF_RANGE',
    'FAILED_PRECONDITION',
    'PERMISSION_DENIED',
    'UNAUTHENTICATED',
    'INTERNAL',
    'DATA_LOSS',
    'UNKNOWN',
  ] as const;
  const TRANSIENT = ['UNAVAILABLE', 'DEADLINE_EXCEEDED', 'ABORTED', 'RESOURCE_EXHAUSTED'] as const;
  const ABSENT = ['NOT_FOUND', 'UNIMPLEMENTED'] as const;

  async function failedWith(code: (typeof PERMANENT | typeof TRANSIENT | typeof ABSENT)[number]) {
    let now = 0;
    const source = memorySource({ points: HISTORY });
    const data = opened(source, { retry: { delayMs: 100, maxDelayMs: 1000 }, now: () => now });
    source.failWith = new ChartDataError(code, 'failed');
    await shown(source, data, need(900, 1000));
    source.failWith = undefined;
    now = 10_000;
    await frame(data, need(900, 1000));
    return { source, data };
  }

  it.each(PERMANENT)('%s marks the range failed and is not retried by itself', async code => {
    const { source, data } = await failedWith(code);

    expect(source.requests).toHaveLength(1);
    expect(data.failed.map(failure => failure.error.code)).toEqual([code]);
    expect(source.subscriptions).toHaveLength(1);
  });

  it.each(TRANSIENT)('%s is asked again after the pause', async code => {
    const { source, data } = await failedWith(code);

    expect(source.requests).toHaveLength(2);
    expect(data.failed).toEqual([]);
  });

  it.each(ABSENT)(
    '%s takes the whole shape and scale out: no requests, no subscription',
    async code => {
      const { source, data } = await failedWith(code);
      await frame(data, need(0, 100));

      expect(source.requests).toHaveLength(1);
      expect(source.subscriptions).toHaveLength(0);
      expect(data.failed.map(failure => failure.error.code)).toEqual([code]);
    }
  );

  it('does not count a cancelled request as a failure', async () => {
    const source = memorySource({ points: HISTORY });
    const data = opened(source);
    source.failWith = new ChartDataError('CANCELLED', 'aborted');

    await shown(source, data, need(900, 1000));

    expect(data.failed).toEqual([]);
  });

  it('takes an error without a code for UNKNOWN', async () => {
    const source = memorySource({ points: HISTORY });
    source.fetch = async () => {
      throw new Error('boom');
    };
    const data = opened(source);

    await shown(source, data, need(900, 1000));

    expect(data.failed.map(failure => failure.error.code)).toEqual(['UNKNOWN']);
  });
});

describe('a time series reading from the persistent cache while the source is being asked', () => {
  it('leaves to the source what it is already being asked for', async () => {
    const cache = memoryPersistentCache();
    cache.write('series|point|1000000000', {
      start: 0n,
      end: 99n * SECOND,
      columns: columnsOf({ shape: 'point', points: HISTORY.slice(0, 100) }),
    });
    const source = memorySource({ points: HISTORY.slice(0, 300) });
    const data = opened(source, { key: 'series', cache: { persistent: cache } });
    data.prepare([narrow(100)]);
    source.start(299n * SECOND);
    await frame(data, narrow(100));
    data.prepare([narrow(100)]);
    data.prepare([narrow(0)]);
    await settle();
    await frame(data, narrow(0));

    expect(data.failed).toEqual([]);
    const times = timesOf(data, narrow(0));
    expect(new Set(times).size).toBe(times.length);
    expect(times[0]).toBe(0n);
  });
});

describe('a time series that freed memory under its live edge', () => {
  it('keeps on disk only the part of the live segment it still holds', async () => {
    const cache = memoryPersistentCache();
    const source = memorySource({ points: [] });
    const data = opened(source, {
      key: 'series',
      cache: { persistent: cache, memory: { maxElements: 10 } },
    });
    await shown(source, data, narrow(0), 0n);
    await frame(data, narrow(0));
    for (let second = 1n; second <= 100n; second += 1n) {
      source.push({ shape: 'point', points: [{ x: second * SECOND, value: 1 }] });
    }

    await frame(data, narrow(-5000));
    data.suspend();

    const delivered = (cache.stored.get('series|point|1000000000') ?? []).filter(
      segment => segment.start > 0n
    );
    for (const segment of delivered) {
      expect(segment.end).toBeGreaterThanOrEqual(segment.start);
      const spanSeconds = Number((segment.end - segment.start) / SECOND);
      expect(segment.columns.length).toBeGreaterThanOrEqual(spanSeconds);
    }
  });
});

describe('a time series retrying what failed', () => {
  function retrying() {
    const clock = { now: 0 };
    const source = memorySource({ points: HISTORY });
    const data = opened(source, {
      retry: { delayMs: 100, maxDelayMs: 1000 },
      now: () => clock.now,
    });
    return { clock, source, data };
  }

  it('keeps the range marked as failed while it asks again: no flicker back to loading', async () => {
    const { clock, source, data } = retrying();
    source.failWith = new ChartDataError('UNAVAILABLE', 'down');
    await shown(source, data, need(900, 1000));

    clock.now = 150;
    data.prepare([need(900, 1000)]);

    expect(source.requests).toHaveLength(2);
    expect(data.loading).toEqual([]);
    expect(data.failed.map(failure => failure.error.code)).toEqual(['UNAVAILABLE']);

    await settle();
    expect(data.loading).toEqual([]);
    expect(data.failed).toHaveLength(1);
  });

  it('takes the mark off when a retry succeeds', async () => {
    const { clock, source, data } = retrying();
    source.failWith = new ChartDataError('UNAVAILABLE', 'down');
    await shown(source, data, need(900, 1000));
    source.failWith = undefined;

    clock.now = 150;
    await frame(data, need(900, 1000));

    expect(data.failed).toEqual([]);
    expect(timesOf(data, need(900, 1000)).length).toBeGreaterThan(0);
  });

  it('stops retrying what left the view, and asks at once when the view comes back', async () => {
    const { clock, source, data } = retrying();
    source.failWith = new ChartDataError('UNAVAILABLE', 'down');
    await shown(source, data, narrow(900));
    source.failWith = undefined;

    await frame(data, narrow(100));
    clock.now = 5000;
    await frame(data, narrow(100));
    const whileAway = source.requests.filter(request => request.to === 999n * SECOND);
    expect(whileAway).toHaveLength(1);
    expect(data.failed).toEqual([]);

    clock.now = 5001;
    await frame(data, narrow(900));
    expect(timesOf(data, narrow(900)).at(-1)).toBe(999n * SECOND);
  });

  it('asks again at once when the subscription starts anew: the source is back, there is nothing to wait for', async () => {
    const clock = { now: 0 };
    const source = memorySource({ points: HISTORY });
    const data = opened(source, {
      retry: { delayMs: 100, maxDelayMs: 60_000 },
      now: () => clock.now,
    });
    source.failWith = new ChartDataError('UNAVAILABLE', 'down');
    await shown(source, data, need(900, 1000));
    for (const moment of [150, 400, 900]) {
      clock.now = moment;
      await frame(data, need(900, 1000));
    }
    expect(source.requests).toHaveLength(4);
    source.failWith = undefined;

    clock.now = 901;
    source.start(999n * SECOND);
    await frame(data, need(900, 1000));

    expect(source.requests).toHaveLength(5);
    expect(data.failed).toEqual([]);
    expect(timesOf(data, need(900, 1000)).length).toBeGreaterThan(0);
  });

  it('keeps a failure that will not be retried where it happened, however far the view goes', async () => {
    const source = memorySource({ points: HISTORY });
    const data = opened(source);
    source.failWith = new ChartDataError('INTERNAL', 'broken');
    await shown(source, data, narrow(900));
    source.failWith = undefined;

    await frame(data, narrow(100));
    await frame(data, narrow(900));
    await frame(data, narrow(900));

    expect(data.failed.map(failure => failure.error.code)).toEqual(['INTERNAL']);
    expect(source.requests.filter(request => request.to === 999n * SECOND)).toHaveLength(1);
  });
});

describe('a time series whose subscription cannot start because the source is down', () => {
  it('says the range failed instead of loading for ever', async () => {
    const source = memorySource({ points: HISTORY });
    const data = opened(source);
    data.prepare([need(900, 1000)]);

    source.error(new ChartDataError('UNAVAILABLE', 'down'));
    data.prepare([need(900, 1000)]);

    expect(data.loading).toEqual([]);
    expect(data.failed.map(failure => failure.error.code)).toEqual(['UNAVAILABLE']);
    expect(data.failed[0].range).toEqual(need(900, 1000).range);
    expect(source.requests).toHaveLength(0);
  });

  it('loads as usual once the source is up', async () => {
    const source = memorySource({ points: HISTORY });
    const data = opened(source);
    data.prepare([need(900, 1000)]);
    source.error(new ChartDataError('UNAVAILABLE', 'down'));

    source.start(999n * SECOND);
    await frame(data, need(900, 1000));

    expect(data.failed).toEqual([]);
    expect(timesOf(data, need(900, 1000)).length).toBeGreaterThan(0);
  });
});
