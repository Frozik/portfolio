import { Temporal } from 'temporal-polyfill';

import { floatingDateStart, floatingMinute } from './floating-time';

describe('the floating minute', () => {
  it('of a moment mid-minute is the minute it is in, as the screening service counts it', () => {
    const start = floatingDateStart(Temporal.PlainDate.from('2026-11-08'));
    expect(floatingMinute(Temporal.PlainDateTime.from('2026-11-08T09:35:23.5'))).toBe(
      start + 9 * 60 + 35
    );
  });
});
