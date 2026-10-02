import { columnsOf } from '@frozik/charts/core/series/columns';
import { ChartDataError } from '@frozik/charts/core/series/data-error';
import { timesOf } from '@frozik/charts/data/timeseries/time-columns';
import { TIME_SCALE } from '@frozik/charts/data/timeseries/time-scale';
import { describeTimeseriesSource } from '@frozik/charts/testing/timeseries-source-contract';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createNoise } from '../domain/noise';
import { noiseSource } from './noise-source';

const SECOND = 1_000_000_000n;
const HOUR = 3600n * SECOND;
const noise = createNoise({ seed: 'test', period: 24n * HOUR });

describeTimeseriesSource('noise, endless', {
  create: () => noiseSource({ noise, delayMs: () => 0 }),
  from: 10n * HOUR,
  to: 11n * HOUR,
  scale: TIME_SCALE.seconds15,
  shape: 'point',
  softLimit: 50,
});

describeTimeseriesSource('noise, candles up to the present', {
  create: () => noiseSource({ noise, delayMs: () => 0, now: () => 11n * HOUR + 7n * SECOND }),
  from: 10n * HOUR,
  to: 12n * HOUR,
  scale: TIME_SCALE.seconds15,
  shape: 'candle',
  softLimit: 50,
});

describe('the noise source at the live edge', () => {
  let present = 0n;

  beforeEach(() => {
    vi.useFakeTimers();
    present = 10n * HOUR + 7n * SECOND;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function subscribed(shape: 'point' | 'candle') {
    const source = noiseSource({ noise, delayMs: () => 0, now: () => present });
    const received = { since: undefined as bigint | undefined, times: [] as bigint[], pending: 0 };
    const unsubscribe = source.subscribe({
      scale: TIME_SCALE.seconds5,
      shape,
      onStart: since => {
        received.since = since;
      },
      onBatch: batch => {
        received.times.push(...timesOf(columnsOf(batch)));
      },
      onPending: () => {
        received.pending += 1;
      },
      onError: () => {},
    });
    return { source, received, unsubscribe };
  }

  it('starts at the last element that exists and sends only later ones', () => {
    const { received } = subscribed('point');
    vi.advanceTimersByTime(0);
    expect(received.since).toBe(10n * HOUR + 5n * SECOND);

    present += 11n * SECOND;
    vi.advanceTimersByTime(1000);

    expect(received.times).toEqual([10n * HOUR + 10n * SECOND, 10n * HOUR + 15n * SECOND]);
  });

  it('has no candle for an interval that has not closed, and shows it as pending', () => {
    const { received } = subscribed('candle');
    vi.advanceTimersByTime(0);

    expect(received.since).toBe(10n * HOUR);
    expect(received.pending).toBeGreaterThan(0);
  });

  it('answers a request with nothing later than the present', async () => {
    const { source } = subscribed('point');

    const answer = source.fetch({
      from: 10n * HOUR,
      to: 11n * HOUR,
      includeFrom: true,
      includeTo: true,
      scale: TIME_SCALE.seconds5,
      shape: 'point',
      direction: 'forward',
      softLimit: 1000,
      signal: new AbortController().signal,
    });
    vi.advanceTimersByTime(0);
    const batch = await answer;

    expect(Array.from(timesOf(columnsOf(batch)))).toEqual([10n * HOUR, 10n * HOUR + 5n * SECOND]);
  });

  it('stops sending once unsubscribed', () => {
    const { received, unsubscribe } = subscribed('point');
    vi.advanceTimersByTime(0);

    unsubscribe();
    present += 60n * SECOND;
    vi.advanceTimersByTime(5000);

    expect(received.times).toEqual([]);
  });

  it('delivers nothing while it is failing, says so once, and starts anew when it is back', () => {
    let down: ChartDataError | undefined;
    const source = noiseSource({
      noise,
      delayMs: () => 0,
      now: () => present,
      failure: () => down,
    });
    const log: string[] = [];
    source.subscribe({
      scale: TIME_SCALE.seconds5,
      shape: 'point',
      onStart: since => log.push(`start ${(since - 10n * HOUR) / SECOND}`),
      onBatch: batch => log.push(`batch ${columnsOf(batch).length}`),
      onError: error => log.push(`error ${error instanceof ChartDataError ? error.code : '?'}`),
    });
    vi.advanceTimersByTime(0);

    down = new ChartDataError('UNAVAILABLE', 'down');
    present += 20n * SECOND;
    vi.advanceTimersByTime(3000);
    down = undefined;
    vi.advanceTimersByTime(1000);
    present += 5n * SECOND;
    vi.advanceTimersByTime(1000);

    expect(log).toEqual(['start 5', 'error UNAVAILABLE', 'start 25', 'batch 1']);
  });

  it('rejects a request aborted while it waits as cancelled', async () => {
    const source = noiseSource({ noise, delayMs: () => 500, now: () => present });
    const controller = new AbortController();
    const answer = source.fetch({
      to: 10n * HOUR,
      includeFrom: false,
      includeTo: true,
      scale: TIME_SCALE.seconds5,
      shape: 'point',
      direction: 'backward',
      softLimit: 10,
      signal: controller.signal,
    });

    controller.abort();

    await expect(answer).rejects.toMatchObject({ code: 'CANCELLED' });
  });
});
