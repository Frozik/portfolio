import { describe, expect, it } from 'vitest';

import { intersection, subtract, TIME_MAX } from './interval';

describe('intervals of time', () => {
  it('leaves the whole interval when nothing is taken from it', () => {
    expect(subtract({ start: 0n, end: 10n }, [])).toEqual([{ start: 0n, end: 10n }]);
  });

  it('leaves the gaps between what is taken, whatever order it comes in', () => {
    const left = subtract({ start: 0n, end: 100n }, [
      { start: 60n, end: 70n },
      { start: 10n, end: 20n },
    ]);

    expect(left).toEqual([
      { start: 0n, end: 9n },
      { start: 21n, end: 59n },
      { start: 71n, end: 100n },
    ]);
  });

  it('leaves nothing of an interval that is taken whole', () => {
    expect(subtract({ start: 5n, end: 10n }, [{ start: 0n, end: TIME_MAX }])).toEqual([]);
  });

  it('ignores what lies outside and trims what sticks out', () => {
    const left = subtract({ start: 10n, end: 20n }, [
      { start: 0n, end: 12n },
      { start: 18n, end: 30n },
      { start: 40n, end: 50n },
    ]);

    expect(left).toEqual([{ start: 13n, end: 17n }]);
  });

  it('finds the common part of two intervals, or none', () => {
    expect(intersection({ start: 0n, end: 10n }, { start: 5n, end: 20n })).toEqual({
      start: 5n,
      end: 10n,
    });
    expect(intersection({ start: 0n, end: 4n }, { start: 5n, end: 20n })).toBeUndefined();
  });
});
