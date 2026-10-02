import { describe, expect, it } from 'vitest';

import { columnsOf } from '../../core/series/columns';
import { boundsOf, coveredBy, planFetches } from './fetch-plan';
import { TIME_MAX, TIME_MIN } from './interval';

const WANTED = { start: 100n, end: 200n };

function pointsAt(...times: readonly bigint[]) {
  return columnsOf({ shape: 'point', points: times.map(x => ({ x, value: 1 })) });
}

describe('plan of requests', () => {
  it('reads an untouched range backward from its right edge, with no far bound', () => {
    const [plan, ...rest] = planFetches(WANTED, [], []);

    expect(rest).toEqual([]);
    expect(plan.direction).toBe('backward');
    expect(plan.reserved).toEqual({ start: TIME_MIN, end: 200n });
    expect(boundsOf(plan)).toEqual({
      from: undefined,
      to: 200n,
      includeFrom: false,
      includeTo: true,
    });
  });

  it('asks for nothing under the live edge', () => {
    const plans = planFetches(WANTED, [{ start: 151n, end: TIME_MAX }], []);

    expect(plans).toHaveLength(1);
    expect(plans[0].hole).toEqual({ start: 100n, end: 150n });
    expect(boundsOf(plans[0]).to).toBe(150n);
  });

  it('grows what is known on the left forward from its edge', () => {
    const [plan] = planFetches(WANTED, [{ start: 0n, end: 120n }], []);

    expect(plan.direction).toBe('forward');
    expect(boundsOf(plan)).toMatchObject({ from: 120n, includeFrom: false, to: 200n });
  });

  it('stops a backward read at what is known or being asked for on its left', () => {
    const [plan] = planFetches(WANTED, [{ start: 0n, end: 50n }], [{ start: 60n, end: 80n }]);

    expect(plan.direction).toBe('backward');
    expect(plan.reserved).toEqual({ start: 81n, end: 200n });
    expect(boundsOf(plan).from).toBe(80n);
  });

  it('asks for every hole, latest first, and for nothing already on its way', () => {
    const plans = planFetches(WANTED, [{ start: 120n, end: 130n }], [{ start: 160n, end: 170n }]);

    expect(plans.map(plan => plan.hole)).toEqual([
      { start: 171n, end: 200n },
      { start: 131n, end: 159n },
      { start: 100n, end: 119n },
    ]);
  });

  it('counts the whole interval as read when the answer is short of the limit', () => {
    const [plan] = planFetches(WANTED, [], []);

    expect(coveredBy(plan, pointsAt(150n, 160n), 3)).toEqual({ start: TIME_MIN, end: 200n });
  });

  it('counts a cut answer as read only from the element the limit stopped on', () => {
    const [backward] = planFetches(WANTED, [], []);
    const [forward] = planFetches(WANTED, [{ start: 0n, end: 99n }], []);

    expect(coveredBy(backward, pointsAt(150n, 160n, 170n), 3)).toEqual({ start: 150n, end: 200n });
    expect(coveredBy(forward, pointsAt(110n, 120n, 130n), 3)).toEqual({ start: 100n, end: 130n });
  });
});
