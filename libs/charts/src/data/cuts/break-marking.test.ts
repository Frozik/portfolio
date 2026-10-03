import { afterEach, describe, expect, it, vi } from 'vitest';

import { columnsOf } from '../../core/series/columns';
import type { TRun } from '../../core/series/point-run';
import { runOf } from '../../core/series/point-run';
import { cutsMapping } from '../../core/viewport/axis-mapping';
import { numberDomain } from '../../core/viewport/number-domain';
import { BreakMarking } from './break-marking';

/** The world axis with 40…60 and 140…160 taken out. */
const mapping = cutsMapping(numberDomain, [
  { from: 40, to: 60 },
  { from: 140, to: 160 },
]);

function virtualRun(worldXs: readonly number[], id = 1, revision = 0): TRun<number> {
  return runOf(
    columnsOf({
      shape: 'point',
      points: worldXs.map(x => ({ x: mapping.toVirtual(x), value: x })),
    }),
    { id, revision, step: 10, aggregateTime: 'start' }
  );
}

describe('marking the breaks of runs as they change', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('marks a run once per revision and hands the same run back until it changes', () => {
    const marking = new BreakMarking(numberDomain, mapping);
    const first = marking.of([virtualRun([30, 60])]);

    expect(marking.of([virtualRun([30, 60])])[0]).toBe(first[0]);
    expect(marking.of([virtualRun([30, 60], 1, 1)])[0]).not.toBe(first[0]);
  });

  it('marks only what was appended to a run already marked', () => {
    const marking = new BreakMarking(numberDomain, mapping);
    const cutsIn = vi.spyOn(mapping, 'cutsIn');
    marking.of([virtualRun([30, 60, 70])]);
    cutsIn.mockClear();

    const [grown] = marking.of([virtualRun([30, 60, 70, 130, 160, 170], 1, 1)]);

    // Positions are virtual: the world 70 and 170 stand at 50 and 130.
    expect(cutsIn).toHaveBeenCalledTimes(1);
    expect(cutsIn.mock.calls[0][0]).toEqual({ start: 50, end: 130 });
    expect(grown.breakMarkers).toEqual([1, 5]);
    expect(Array.from(grown.x)).toEqual([30, 40, 40, 50, 110, 120, 120, 130]);
  });

  it('marks only what was put in front of a run already marked, under a new id', () => {
    const marking = new BreakMarking(numberDomain, mapping);
    marking.of([virtualRun([130, 160, 170], 1)]);
    const cutsIn = vi.spyOn(mapping, 'cutsIn');

    const [grown] = marking.of([virtualRun([30, 60, 70, 130, 160, 170], 2)]);

    expect(cutsIn).toHaveBeenCalledTimes(1);
    expect(cutsIn.mock.calls[0][0]).toEqual({ start: 30, end: 110 });
    expect(grown.breakMarkers).toEqual([1, 5]);
  });

  it('forgets a run that is gone', () => {
    const marking = new BreakMarking(numberDomain, mapping);
    marking.of([virtualRun([30, 60], 1)]);
    marking.of([virtualRun([130, 160], 2)]);
    const cutsIn = vi.spyOn(mapping, 'cutsIn');

    marking.of([virtualRun([30, 60, 70], 3)]);

    expect(cutsIn.mock.calls[0][0]).toEqual({ start: 30, end: 50 });
  });
});
