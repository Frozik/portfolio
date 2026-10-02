import { describe, expect, it } from 'vitest';

import { columnsOf } from '../core/series/columns';
import type { TShape } from '../core/series/shape';
import type { IFetchRequest, ITimeseriesSource } from '../data/timeseries/source';
import { timesOf } from '../data/timeseries/time-columns';
import type { TTimeScale } from '../data/timeseries/time-scale';

export interface ISourceContractOptions {
  create(): ITimeseriesSource;
  /** A range the source has more than `softLimit` elements in, at `scale`. */
  readonly from: bigint;
  readonly to: bigint;
  readonly scale: TTimeScale;
  readonly shape: TShape;
  /** Small enough that the range needs several answers. */
  readonly softLimit: number;
}

const EVERYTHING = Number.MAX_SAFE_INTEGER;
const START_TIMEOUT_MS = 1000;

/**
 * The guarantees every time series source owes the chart (§4.4), as a test
 * suite: run it over a demo source and over the adapter of a real server
 * alike. The soft limit in particular is kept by the server, and this is the
 * only way to check it.
 */
export function describeTimeseriesSource(name: string, options: ISourceContractOptions): void {
  const { from, to, scale, shape, softLimit } = options;

  async function times(
    source: ITimeseriesSource,
    request: Partial<IFetchRequest>
  ): Promise<readonly bigint[]> {
    const batch = await source.fetch({
      from,
      to,
      includeFrom: true,
      includeTo: true,
      scale,
      shape,
      direction: 'forward',
      softLimit: EVERYTHING,
      signal: new AbortController().signal,
      ...request,
    });
    expect(batch.shape).toBe(shape);
    return Array.from(timesOf(columnsOf(batch)));
  }

  describe(`time series source contract: ${name}`, () => {
    it('has more elements in the range than the limit used by the suite', async () => {
      expect((await times(options.create(), {})).length).toBeGreaterThan(softLimit * 2);
    });

    it('answers in ascending order of time, whatever the direction', async () => {
      const source = options.create();
      for (const direction of ['forward', 'backward'] as const) {
        const answer = await times(source, { direction, softLimit });
        expect(answer).toEqual([...answer].sort((first, second) => (first < second ? -1 : 1)));
      }
    });

    it('stays inside the bounds', async () => {
      const all = await times(options.create(), {});

      expect(all[0]).toBeGreaterThanOrEqual(from);
      expect(all.at(-1)).toBeLessThanOrEqual(to);
    });

    it('gives at least the limit, cut from the end the direction names', async () => {
      const source = options.create();
      const all = await times(source, {});

      const forward = await times(source, { direction: 'forward', softLimit });
      const backward = await times(source, { direction: 'backward', softLimit });

      expect(forward.length).toBeGreaterThanOrEqual(softLimit);
      expect(backward.length).toBeGreaterThanOrEqual(softLimit);
      expect(forward).toEqual(all.slice(0, forward.length));
      expect(backward).toEqual(all.slice(all.length - backward.length));
    });

    it('never splits a time between two answers', async () => {
      const source = options.create();
      const all = await times(source, {});

      const forward = await times(source, { direction: 'forward', softLimit });
      const backward = await times(source, { direction: 'backward', softLimit });

      expect(all[forward.length]).not.toBe(forward.at(-1));
      expect(all[all.length - backward.length - 1]).not.toBe(backward[0]);
    });

    it('leaves out exactly the elements at a bound that is not included', async () => {
      const source = options.create();
      const all = await times(source, {});
      const first = all[0];
      const last = all[all.length - 1];

      const inner = await times(source, {
        from: first,
        to: last,
        includeFrom: false,
        includeTo: false,
      });

      expect(inner).toEqual(all.filter(time => time !== first && time !== last));
    });

    it('pages through the range forward without a gap or a duplicate', async () => {
      const source = options.create();
      const all = await times(source, {});

      const paged: bigint[] = [];
      let cursor: Partial<IFetchRequest> = {};
      for (;;) {
        const page = await times(source, { ...cursor, direction: 'forward', softLimit });
        paged.push(...page);
        if (page.length < softLimit) {
          break;
        }
        cursor = { from: page[page.length - 1], includeFrom: false };
      }

      expect(paged).toEqual(all);
    });

    it('pages through the range backward without a gap or a duplicate', async () => {
      const source = options.create();
      const all = await times(source, {});

      const paged: bigint[] = [];
      let cursor: Partial<IFetchRequest> = {};
      for (;;) {
        const page = await times(source, { ...cursor, direction: 'backward', softLimit });
        paged.unshift(...page);
        if (page.length < softLimit) {
          break;
        }
        cursor = { to: page[0], includeTo: false };
      }

      expect(paged).toEqual(all);
    });

    it('answers with nothing, not an error, where it has no elements', async () => {
      const answer = await times(options.create(), {
        from,
        to: from,
        includeFrom: false,
        includeTo: false,
      });

      expect(answer).toEqual([]);
    });

    it('tells a subscription where its live edge starts', async () => {
      const source = options.create();
      const since = await new Promise<bigint>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error('the subscription never started')),
          START_TIMEOUT_MS
        );
        const unsubscribe = source.subscribe({
          scale,
          shape,
          onStart: started => {
            clearTimeout(timeout);
            queueMicrotask(() => unsubscribe());
            resolve(started);
          },
          onBatch: () => {},
          onError: reject,
        });
      });

      expect(typeof since).toBe('bigint');
    });
  });
}
