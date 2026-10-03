import { describe, expect, it } from 'vitest';

import { positionsOf } from '../../core/series/columns';
import { cutsMapping } from '../../core/viewport/axis-mapping';
import { timeDomain } from '../../core/viewport/time-domain';
import type { IMemorySource } from '../../testing/memory-timeseries-source';
import { memorySource } from '../../testing/memory-timeseries-source';
import { CutFetcher } from './cut-fetch';
import type { IFetchRequest, ITimeseriesSource } from './source';
import { TIME_SCALE } from './time-scale';

const SECOND = 1_000_000_000n;
const at = (seconds: number): bigint => BigInt(seconds) * SECOND;
const domain = timeDomain();
/** A point every second for ten minutes. */
const everySecond = (): IMemorySource =>
  memorySource({
    points: Array.from({ length: 601 }, (_, seconds) => ({ x: at(seconds), value: seconds })),
  });
/** The cut 100…200 s is a hundred elements wide: worth going round when a request is worth ten. */
const mapping = cutsMapping(domain, [{ from: at(100), to: at(200) }]);

function fetcherOf(source: ITimeseriesSource, requestWorth: number): CutFetcher {
  return new CutFetcher({ source, domain, mapping, aggregateTime: 'start', requestWorth });
}

function request(overrides: Partial<IFetchRequest> = {}): IFetchRequest {
  return {
    from: at(50),
    to: mapping.toVirtual(at(250)),
    includeFrom: true,
    includeTo: true,
    scale: SECOND,
    shape: 'point',
    direction: 'forward',
    softLimit: 1000,
    signal: new AbortController().signal,
    ...overrides,
  };
}

function secondsOf(columns: { readonly x: BigInt64Array | Float64Array }): readonly number[] {
  return Array.from(positionsOf<bigint>(columns.x), time => Number(time / SECOND));
}

/** A source that knows the schedule: it leaves out what it is told to skip. */
function skipping(source: ITimeseriesSource): ITimeseriesSource {
  return {
    ...source,
    async fetch(fetched): ReturnType<ITimeseriesSource['fetch']> {
      const answer = await source.fetch(fetched);
      if (answer.shape !== 'point' || !Array.isArray(answer.points)) {
        return answer;
      }
      const skip = fetched.skip ?? [];
      return {
        shape: 'point',
        points: answer.points.filter(
          point => !skip.some(cut => point.x > cut.from && point.x < cut.to)
        ),
      };
    },
  };
}

describe('fetching through the cuts', () => {
  it('goes round a cut worth going round in two requests and answers in one ascending run', async () => {
    const source = everySecond();
    const answer = await fetcherOf(source, 10).fetch(request());

    expect(source.requests.map(({ from, to }) => [from, to])).toEqual([
      [at(50), at(100)],
      [at(199), at(250)],
    ]);
    const seconds = secondsOf(answer);
    expect(seconds[0]).toBe(50);
    expect(seconds.at(-1)).toBe(150);
    expect(seconds).toEqual([...seconds].sort((first, second) => first - second));
    expect(seconds).toHaveLength(101);
  });

  it('asks the far piece first when the direction is backward, and still answers ascending', async () => {
    const source = everySecond();
    const answer = await fetcherOf(source, 10).fetch(request({ direction: 'backward' }));

    expect(source.requests.map(({ from }) => from)).toEqual([at(199), at(50)]);
    expect(secondsOf(answer)[0]).toBe(50);
    expect(secondsOf(answer).at(-1)).toBe(150);
  });

  it('asks the bounds whole with the cut named to skip when it is not worth going round', async () => {
    const source = everySecond();
    await fetcherOf(source, 1000).fetch(request());

    expect(source.requests).toHaveLength(1);
    expect(source.requests[0]).toMatchObject({
      from: at(50),
      to: at(250),
      skip: [{ from: at(100), to: at(200) }],
    });
  });

  it('stops splitting once the source has shown that it leaves the skipped stretches out itself', async () => {
    const twoCuts = cutsMapping(domain, [
      { from: at(100), to: at(105) },
      { from: at(300), to: at(400) },
    ]);
    const fetcherOver = (source: ITimeseriesSource): CutFetcher =>
      new CutFetcher({
        source,
        domain,
        mapping: twoCuts,
        aggregateTime: 'start',
        requestWorth: 10,
      });
    const honest = everySecond();
    const ignorant = everySecond();
    const fetchers = [fetcherOver(skipping(honest)), fetcherOver(ignorant)];

    for (const fetcher of fetchers) {
      await fetcher.fetch(request({ from: at(50), to: twoCuts.toVirtual(at(150)) }));
      await fetcher.fetch(request({ from: at(50), to: twoCuts.toVirtual(at(500)) }));
    }

    expect(honest.requests).toHaveLength(2);
    expect(honest.requests[1].skip).toEqual([
      { from: at(100), to: at(105) },
      { from: at(300), to: at(400) },
    ]);
    expect(ignorant.requests).toHaveLength(3);
  });

  it('leaves out a bar already given at the cut when the next request starts there, as the channel does', async () => {
    // 5-second bars from the epoch; the bar at 195 s starts inside the cut 100…200 s and runs out of it.
    const bars = memorySource({
      points: Array.from({ length: 61 }, (_, index) => ({ x: at(index * 5), value: index })),
    });
    const fetcher = new CutFetcher({
      source: bars,
      domain,
      mapping,
      aggregateTime: 'start',
      requestWorth: 1000,
    });
    const cutPoint = mapping.toVirtual(at(195));

    const upTo = await fetcher.fetch(
      request({ from: at(50), to: cutPoint, scale: TIME_SCALE.seconds5 })
    );
    const after = await fetcher.fetch(
      request({ from: cutPoint, includeFrom: false, to: at(150), scale: TIME_SCALE.seconds5 })
    );

    expect(secondsOf(upTo).at(-1)).toBe(100);
    expect(secondsOf(after)[0]).toBe(105);
  });

  it('asks on from where the limit stopped an answer short until the limit is met, never less than a request is worth', async () => {
    const source = everySecond();
    const answer = await fetcherOf(source, 20).fetch(request({ softLimit: 60 }));

    // The cut is worth going round: the first piece falls ten short, the second is asked a full request's worth.
    expect(source.requests.map(({ from, softLimit }) => [from, softLimit])).toEqual([
      [at(50), 60],
      [at(199), 21],
    ]);
    const seconds = secondsOf(answer);
    expect(seconds[0]).toBe(50);
    expect(seconds).toEqual([...seconds].sort((first, second) => first - second));
    expect(seconds.length).toBeGreaterThanOrEqual(60);
  });

  it('gives fewer than the limit only when the bounds were read whole, however many cuts lie inside', async () => {
    const source = everySecond();
    const manyCuts = cutsMapping(
      domain,
      Array.from({ length: 20 }, (_, index) => ({
        from: at(60 + index * 10),
        to: at(69 + index * 10),
      }))
    );
    const fetcher = new CutFetcher({
      source,
      domain,
      mapping: manyCuts,
      aggregateTime: 'start',
      requestWorth: 2,
    });
    const to = manyCuts.toVirtual(at(300));

    const answer = await fetcher.fetch(request({ from: at(50), to, softLimit: 25 }));

    expect(secondsOf(answer).length).toBeGreaterThanOrEqual(25);
  });
});
