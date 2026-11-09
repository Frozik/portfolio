import { Temporal } from 'temporal-polyfill';

import { floatingMinute } from './floating-time';
import { ALL_TIME, nextBoundary } from './window-set';

const NOW = floatingMinute(Temporal.PlainDateTime.from('2026-11-09T10:00'));

describe('the next change of a set of windows', () => {
  it('is never for windows that last all the time', () => {
    expect(nextBoundary(ALL_TIME, NOW)).toBeNull();
  });

  it('is the end of the window the moment is in', () => {
    const until = floatingMinute(Temporal.PlainDateTime.from('2026-11-09T18:00'));
    expect(nextBoundary([{ from: NOW, to: until }], NOW)).toBe(until);
  });
});
