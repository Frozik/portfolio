import { describe, expect, it } from 'vitest';

import { columnsOf } from '../../core/series/columns';
import type { TAggregateTime, TRun } from '../../core/series/point-run';
import { runOf } from '../../core/series/point-run';
import { cutsMapping } from '../../core/viewport/axis-mapping';
import { numberDomain } from '../../core/viewport/number-domain';
import { markBreaks } from './break-markers';

/** The world axis with 40…60 taken out; elements arrive in the virtual coordinate, as the data keeps them. */
const mapping = cutsMapping(numberDomain, [{ from: 40, to: 60 }]);

function virtualRun(
  worldXs: readonly number[],
  step: number | undefined,
  aggregateTime: TAggregateTime = 'start',
  revision = 0
): TRun<number> {
  return runOf(
    columnsOf({
      shape: 'point',
      points: worldXs.map(x => ({ x: mapping.toVirtual(x), value: x })),
    }),
    { id: 1, revision, step, aggregateTime }
  );
}

describe('break markers at the cuts of a run', () => {
  it('marks a long run over thousands of cuts in a few milliseconds', () => {
    const manyCuts = cutsMapping(
      numberDomain,
      Array.from({ length: 8000 }, (_, index) => ({ from: index * 24 + 14, to: index * 24 + 24 }))
    );
    const worldXs = Array.from({ length: 8000 * 14 }, (_, index) => {
      const day = Math.floor(index / 14);
      return day * 24 + (index % 14);
    });
    const run = runOf<number>(
      columnsOf({
        shape: 'point',
        points: worldXs.map(x => ({ x: manyCuts.toVirtual(x), value: x })),
      }),
      { id: 1, revision: 0, step: 1, aggregateTime: 'start' }
    );
    const started = performance.now();

    const marked = markBreaks(numberDomain, manyCuts, run);

    expect(performance.now() - started).toBeLessThan(50);
    expect(marked.breakMarkers).toHaveLength(7999);
  });

  it('puts a technical NaN between neighbours with the cut wholly between their intervals', () => {
    const marked = markBreaks(numberDomain, mapping, virtualRun([30, 60, 70], 10));

    expect(Array.from(marked.x)).toEqual([30, 40, 40, 50]);
    expect(marked.shape === 'point' ? [...marked.value] : []).toEqual([30, Number.NaN, 60, 70]);
    expect(marked.breakMarkers).toEqual([1]);
  });

  it('leaves neighbours alone when the cut lies inside one of their intervals', () => {
    const marked = markBreaks(numberDomain, mapping, virtualRun([35, 60], 10));

    expect(marked.breakMarkers).toEqual([]);
    expect(Array.from(marked.x)).toEqual([35, 40]);
  });

  it('leaves elements no shorter than the open stretch before the cut unbroken', () => {
    const twoCuts = cutsMapping(numberDomain, [
      { from: 20, to: 30 },
      { from: 40, to: 60 },
    ]);
    const run = runOf<number>(
      columnsOf({
        shape: 'point',
        points: [30, 60].map(x => ({ x: twoCuts.toVirtual(x), value: x })),
      }),
      { id: 1, revision: 0, step: 10, aggregateTime: 'start' }
    );

    expect(markBreaks(numberDomain, twoCuts, run).breakMarkers).toEqual([]);
  });

  it('measures intervals backwards for elements stamped by their end', () => {
    const marked = markBreaks(numberDomain, mapping, virtualRun([40, 70], 10, 'end'));

    expect(marked.breakMarkers).toEqual([1]);
  });

  it('breaks between plain points on the two sides of a cut', () => {
    expect(markBreaks(numberDomain, mapping, virtualRun([30, 70], undefined)).breakMarkers).toEqual(
      [1]
    );
  });
});
