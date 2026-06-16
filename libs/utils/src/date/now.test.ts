import { Temporal } from 'temporal-polyfill';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getNowISO8601, getNowPlainDate, nowEpochMs } from './now';

const FIXED_INSTANT = '2024-03-15T13:45:09.000Z';
const FIXED_EPOCH_MS = Date.parse(FIXED_INSTANT);

describe('now (clock mocked)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function freezeClock(): void {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(FIXED_INSTANT));
  }

  it('nowEpochMs returns the mocked instant in epoch milliseconds', () => {
    freezeClock();
    expect(nowEpochMs()).toBe(FIXED_EPOCH_MS);
  });

  it('getNowISO8601 returns the mocked instant as a parseable ISO string', () => {
    freezeClock();
    const iso = getNowISO8601();
    expect(iso).toBe('2024-03-15T13:45:09Z');
    expect(Temporal.Instant.from(iso).epochMilliseconds).toBe(FIXED_EPOCH_MS);
  });

  it('getNowPlainDate returns the calendar date in UTC by default', () => {
    freezeClock();
    expect(getNowPlainDate().toString()).toBe('2024-03-15');
  });

  it('getNowPlainDate shifts the calendar date for a different time zone', () => {
    // 13:45 UTC is 23:45 in Auckland (UTC+13 in March), still the 15th, but
    // Honolulu (UTC-10) is 03:45 — verify the zone is applied to the date.
    freezeClock();
    expect(getNowPlainDate('Pacific/Honolulu').toString()).toBe('2024-03-15');
    vi.setSystemTime(new Date('2024-03-15T05:00:00.000Z'));
    // 05:00 UTC is 19:00 the previous day in Honolulu.
    expect(getNowPlainDate('Pacific/Honolulu').toString()).toBe('2024-03-14');
  });
});

describe('now (invariants without mocking)', () => {
  it('nowEpochMs equals the epoch milliseconds of getNowISO8601', () => {
    const epochMs = nowEpochMs();
    const isoEpochMs = Temporal.Instant.from(getNowISO8601()).epochMilliseconds;
    // Both read the live clock back-to-back; allow a tiny wall-clock drift.
    expect(Math.abs(epochMs - isoEpochMs)).toBeLessThan(1_000);
  });

  it('nowEpochMs is a finite number', () => {
    expect(Number.isFinite(nowEpochMs())).toBe(true);
  });
});
