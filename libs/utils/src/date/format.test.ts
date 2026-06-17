import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';

import { formatDateTime, formatDateTimeLocal } from './format';
import type { ISO } from './types';

describe('formatDateTime', () => {
  it('formats an instant in UTC by default as "YYYY-MM-DD HH:MM:SS"', () => {
    expect(formatDateTime('2024-03-15T13:45:09Z' as ISO)).toBe('2024-03-15 13:45:09');
  });

  it('drops sub-second precision', () => {
    expect(formatDateTime('2024-03-15T13:45:09.678Z' as ISO)).toBe('2024-03-15 13:45:09');
  });

  it('converts the instant into the requested time zone', () => {
    expect(formatDateTime('2024-03-15T13:45:09Z' as ISO, 'America/New_York')).toBe(
      '2024-03-15 09:45:09'
    );
  });

  it('normalises an offset instant to the target zone (UTC)', () => {
    expect(formatDateTime('2024-01-01T00:30:00+02:00' as ISO)).toBe('2023-12-31 22:30:00');
  });

  it('zero-pads year, month, day, and time components', () => {
    expect(formatDateTime('0007-01-02T03:04:05Z' as ISO)).toBe('0007-01-02 03:04:05');
  });
});

describe('formatDateTimeLocal', () => {
  it('matches formatDateTime in the runtime-local time zone', () => {
    const iso = '2024-03-15T13:45:09Z' as ISO;
    const localZone = Temporal.Now.timeZoneId();
    expect(formatDateTimeLocal(iso)).toBe(formatDateTime(iso, localZone));
  });
});
