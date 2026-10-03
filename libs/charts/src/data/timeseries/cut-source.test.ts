import { describe, expect, it, vi } from 'vitest';

import { columnsOf } from '../../core/series/columns';
import type { IPoint, TBatch } from '../../core/series/shape';
import { cutsMapping } from '../../core/viewport/axis-mapping';
import { timeDomain } from '../../core/viewport/time-domain';
import { memorySource } from '../../testing/memory-timeseries-source';
import { cutTimeseriesSource } from './cut-source';

const SECOND = 1_000_000_000n;
const at = (seconds: number): bigint => BigInt(seconds) * SECOND;
const domain = timeDomain();
/** As much as the cut would bring and no less than the limit asked: every request goes whole. */
const REQUEST_WORTH = 20;
/** Seconds 40…60 are taken out. */
const mapping = cutsMapping(domain, [{ from: at(40), to: at(60) }]);

function pointsOf(batch: TBatch): readonly IPoint[] {
  const columns = columnsOf(batch);
  return columns.shape === 'point'
    ? Array.from({ length: columns.length }, (_, index) => ({
        x: columns.x[index] as bigint,
        value: columns.value[index],
      }))
    : [];
}

function fetched(source: ReturnType<typeof memorySource>, from: bigint, to: bigint) {
  return cutTimeseriesSource(source, domain, mapping, 'start', REQUEST_WORTH).fetch({
    from,
    to,
    includeFrom: true,
    includeTo: true,
    scale: SECOND,
    shape: 'point',
    direction: 'forward',
    softLimit: REQUEST_WORTH,
    signal: new AbortController().signal,
  });
}

describe('a time series source with the cuts applied at its door', () => {
  const data = memorySource({
    points: [30, 40, 50, 60, 70].map(seconds => ({ x: at(seconds), value: seconds })),
  });

  it('asks the source in world time and answers in virtual time without what was cut', async () => {
    const answer = await fetched(data, at(30), at(50));

    expect(data.requests.at(-1)).toMatchObject({ from: at(30), to: at(70) });
    expect(pointsOf(answer)).toEqual([
      { x: at(30), value: 30 },
      { x: at(40), value: 60 },
      { x: at(50), value: 70 },
    ]);
  });

  it('asks for as many more elements as the cut will take away', async () => {
    await fetched(data, at(30), at(50));

    expect(data.requests.at(-1)?.softLimit).toBe(2 * REQUEST_WORTH);
  });

  it('moves the live edge and new elements into virtual time and drops what arrives inside a cut', () => {
    const source = memorySource();
    const onStart = vi.fn();
    const onBatch = vi.fn();
    const onPending = vi.fn();
    cutTimeseriesSource(source, domain, mapping, 'start', REQUEST_WORTH).subscribe({
      scale: SECOND,
      shape: 'point',
      onStart,
      onBatch,
      onPending,
      onError: vi.fn(),
    });

    source.start(at(70));
    source.push({ shape: 'point', points: [{ x: at(80), value: 80 }] });
    source.pending({ x: at(50), value: 50 });
    source.pending({ x: at(90), value: 90 });

    expect(onStart).toHaveBeenCalledWith(at(50));
    expect(pointsOf(onBatch.mock.calls[0][0])).toEqual([{ x: at(60), value: 80 }]);
    expect(onPending.mock.calls.map(([element]) => element)).toEqual([
      undefined,
      { x: at(70), value: 90 },
    ]);
  });
});
