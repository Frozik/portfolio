import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';

import { formatISO8601, formatISO8601Local } from './format';
import type { ISO } from './types';

describe('formatISO8601', () => {
  it('formats an instant in UTC by default as "YYYY-MM-DD HH:MM:SS"', () => {
    expect(formatISO8601('2024-03-15T13:45:09Z' as ISO)).toBe('2024-03-15 13:45:09');
  });

  it('drops sub-second precision', () => {
    expect(formatISO8601('2024-03-15T13:45:09.678Z' as ISO)).toBe('2024-03-15 13:45:09');
  });

  it('converts the instant into the requested time zone', () => {
    expect(formatISO8601('2024-03-15T13:45:09Z' as ISO, 'America/New_York')).toBe(
      '2024-03-15 09:45:09'
    );
  });

  it('normalises an offset instant to the target zone (UTC)', () => {
    expect(formatISO8601('2024-01-01T00:30:00+02:00' as ISO)).toBe('2023-12-31 22:30:00');
  });

  it('zero-pads year, month, day, and time components', () => {
    expect(formatISO8601('0007-01-02T03:04:05Z' as ISO)).toBe('0007-01-02 03:04:05');
  });
});

describe('formatISO8601Local', () => {
  it('matches formatISO8601 in the runtime-local time zone', () => {
    const iso = '2024-03-15T13:45:09Z' as ISO;
    const localZone = Temporal.Now.timeZoneId();
    expect(formatISO8601Local(iso)).toBe(formatISO8601(iso, localZone));
  });
});
