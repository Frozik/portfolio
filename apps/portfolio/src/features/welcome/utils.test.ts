import { Temporal } from '@js-temporal/polyfill';
import {
  formatDateMonthYear,
  getAge,
  getAvailability,
  getYearsOfExperience,
  measureDuration,
} from './utils';

describe('getAvailability', () => {
  it('returns online status during working hours on weekday', () => {
    vi.useFakeTimers();
    // Wednesday 14:00 Moscow time
    vi.setSystemTime(new Date('2026-04-15T14:00:00+03:00'));

    const result = getAvailability();

    expect(result.status).toBe('online');
    expect(result.localTime).toBe('14:00');
    expect(result.title).toContain('Working hours');

    vi.useRealTimers();
  });

  it('returns away status during off hours on weekday', () => {
    vi.useFakeTimers();
    // Wednesday 02:00 Moscow time
    vi.setSystemTime(new Date('2026-04-15T02:00:00+03:00'));

    const result = getAvailability();

    expect(result.status).toBe('away');
    expect(result.localTime).toBe('02:00');
    expect(result.title).toContain('Off hours');

    vi.useRealTimers();
  });

  it('returns weekend status on Saturday', () => {
    vi.useFakeTimers();
    // Saturday 14:00 Moscow time
    vi.setSystemTime(new Date('2026-04-18T14:00:00+03:00'));

    const result = getAvailability();

    expect(result.status).toBe('weekend');
    expect(result.title).toContain('Weekend');

    vi.useRealTimers();
  });

  it('returns weekend status on Sunday', () => {
    vi.useFakeTimers();
    // Sunday 14:00 Moscow time
    vi.setSystemTime(new Date('2026-04-19T14:00:00+03:00'));

    const result = getAvailability();

    expect(result.status).toBe('weekend');

    vi.useRealTimers();
  });

  it('returns away at boundary before awake start hour', () => {
    vi.useFakeTimers();
    // Wednesday 09:59 Moscow time
    vi.setSystemTime(new Date('2026-04-15T09:59:00+03:00'));

    const result = getAvailability();

    expect(result.status).toBe('away');

    vi.useRealTimers();
  });

  it('returns online at exact awake start hour', () => {
    vi.useFakeTimers();
    // Wednesday 10:00 Moscow time
    vi.setSystemTime(new Date('2026-04-15T10:00:00+03:00'));

    const result = getAvailability();

    expect(result.status).toBe('online');

    vi.useRealTimers();
  });

  it('returns away at exact awake end hour', () => {
    vi.useFakeTimers();
    // Wednesday 23:00 Moscow time
    vi.setSystemTime(new Date('2026-04-15T23:00:00+03:00'));

    const result = getAvailability();

    expect(result.status).toBe('away');

    vi.useRealTimers();
  });
});

describe('getAge', () => {
  it('returns correct age', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-12T12:00:00Z'));

    expect(getAge()).toBe(43);

    vi.useRealTimers();
  });

  it('returns age before birthday in current year', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-09T12:00:00Z'));

    expect(getAge()).toBe(43);

    vi.useRealTimers();
  });

  it('returns incremented age on birthday', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T12:00:00Z'));

    expect(getAge()).toBe(44);

    vi.useRealTimers();
  });
});

describe('getYearsOfExperience', () => {
  it('calculates years from career start to now', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-12T12:00:00Z'));

    const start = new Temporal.PlainDate(2006, 1, 1);
    expect(getYearsOfExperience(start)).toBe(20);

    vi.useRealTimers();
  });

  it('returns 0 for recent start', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-12T12:00:00Z'));

    const start = new Temporal.PlainDate(2026, 1, 1);
    expect(getYearsOfExperience(start)).toBe(0);

    vi.useRealTimers();
  });
});

describe('measureDuration', () => {
  it('returns years and months', () => {
    const start = new Temporal.PlainDate(2020, 1, 1);
    const end = new Temporal.PlainDate(2023, 6, 1);

    expect(measureDuration(start, end)).toBe('3 years 5 months');
  });

  it('returns only years when no remaining months', () => {
    const start = new Temporal.PlainDate(2020, 1, 1);
    const end = new Temporal.PlainDate(2023, 1, 1);

    expect(measureDuration(start, end)).toBe('3 years');
  });

  it('returns only months when less than a year', () => {
    const start = new Temporal.PlainDate(2023, 1, 1);
    const end = new Temporal.PlainDate(2023, 6, 1);

    expect(measureDuration(start, end)).toBe('5 months');
  });

  it('returns "less than a month" for very short duration', () => {
    const start = new Temporal.PlainDate(2023, 1, 1);
    const end = new Temporal.PlainDate(2023, 1, 15);

    expect(measureDuration(start, end)).toBe('less than a month');
  });

  it('returns singular forms for 1 year 1 month', () => {
    const start = new Temporal.PlainDate(2022, 1, 1);
    const end = new Temporal.PlainDate(2023, 2, 1);

    expect(measureDuration(start, end)).toBe('1 year 1 month');
  });
});

describe('formatDateMonthYear', () => {
  it('formats date as "Month Year"', () => {
    const date = new Temporal.PlainDate(2023, 3, 15);

    expect(formatDateMonthYear(date)).toBe('March 2023');
  });

  it('formats January correctly', () => {
    const date = new Temporal.PlainDate(2020, 1, 1);

    expect(formatDateMonthYear(date)).toBe('January 2020');
  });
});
