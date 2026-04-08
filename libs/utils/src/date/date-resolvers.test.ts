import { Temporal } from '@js-temporal/polyfill';
import { describe, expect, it } from 'vitest';
import {
  applyOffsetToSlots,
  parseDirectDateToSlots,
  parseStandaloneTimeToSlots,
  resolveBoundaryKeywordToSlots,
  resolveKeywordToDateSlots,
  resolveKeywordToSlots,
  resolveMonthYearToSlots,
  resolveNextWeekdayToSlots,
  resolvePreviousWeekdayToSlots,
  resolveQuarterFromToken,
  resolveQuarterToSlots,
  resolveTimeKeywordToSlots,
  tryParseDirectDateSlots,
  tryParseISOSlots,
  tryParseStandaloneTimeSlots,
  tryResolveKeyword,
} from './date-resolvers';
import type { IToken } from './token-types';
import { ETokenKind } from './token-types';

const TIME_ZONE = 'UTC';

function makeToken(overrides: Partial<IToken> & { kind: ETokenKind; raw: string }): IToken {
  return {
    value: 0,
    ...overrides,
  };
}

describe('resolveKeywordToSlots', () => {
  const today = Temporal.PlainDate.from('2025-03-15');

  it('resolves "yesterday"', () => {
    const result = resolveKeywordToSlots('yesterday', today);
    expect(result).toEqual({ day: 14, month: 3, year: 2025 });
  });

  it('resolves "tomorrow"', () => {
    const result = resolveKeywordToSlots('tomorrow', today);
    expect(result).toEqual({ day: 16, month: 3, year: 2025 });
  });

  it('resolves "tom" as alias for tomorrow', () => {
    const result = resolveKeywordToSlots('tom', today);
    expect(result).toEqual({ day: 16, month: 3, year: 2025 });
  });

  it('resolves "today"', () => {
    const result = resolveKeywordToSlots('today', today);
    expect(result).toEqual({ day: 15, month: 3, year: 2025 });
  });

  it('resolves "now" same as today', () => {
    const result = resolveKeywordToSlots('now', today);
    expect(result).toEqual({ day: 15, month: 3, year: 2025 });
  });

  it('resolves "noon" with time slots', () => {
    const result = resolveKeywordToSlots('noon', today);
    expect(result).toEqual({
      day: 15,
      month: 3,
      year: 2025,
      hour: 12,
      minute: 0,
      second: 0,
      ms: 0,
    });
  });

  it('resolves "midday" same as noon', () => {
    const result = resolveKeywordToSlots('midday', today);
    expect(result).toEqual({
      day: 15,
      month: 3,
      year: 2025,
      hour: 12,
      minute: 0,
      second: 0,
      ms: 0,
    });
  });

  it('resolves "midnight"', () => {
    const result = resolveKeywordToSlots('midnight', today);
    expect(result).toEqual({
      day: 15,
      month: 3,
      year: 2025,
      hour: 0,
      minute: 0,
      second: 0,
      ms: 0,
    });
  });

  it('resolves "eom" to end of month', () => {
    const result = resolveKeywordToSlots('eom', today);
    expect(result).toEqual({ day: 31, month: 3, year: 2025 });
  });

  it('resolves "end of month" to end of month', () => {
    const result = resolveKeywordToSlots('end of month', today);
    expect(result).toEqual({ day: 31, month: 3, year: 2025 });
  });

  it('resolves "end-of-month" to end of month', () => {
    const result = resolveKeywordToSlots('end-of-month', today);
    expect(result).toEqual({ day: 31, month: 3, year: 2025 });
  });

  it('resolves eom in February for leap year', () => {
    const leapDay = Temporal.PlainDate.from('2024-02-10');
    const result = resolveKeywordToSlots('eom', leapDay);
    expect(result).toEqual({ day: 29, month: 2, year: 2024 });
  });

  it('resolves "bom" to next month 1st when today is not 1st', () => {
    const result = resolveKeywordToSlots('bom', today);
    expect(result).toEqual({ day: 1, month: 4, year: 2025 });
  });

  it('resolves "bom" to current month 1st when today IS 1st', () => {
    const firstDay = Temporal.PlainDate.from('2025-03-01');
    const result = resolveKeywordToSlots('bom', firstDay);
    expect(result).toEqual({ day: 1, month: 3, year: 2025 });
  });

  it('resolves "som" same as bom', () => {
    const result = resolveKeywordToSlots('som', today);
    expect(result).toEqual({ day: 1, month: 4, year: 2025 });
  });

  it('resolves "beginning of month"', () => {
    const result = resolveKeywordToSlots('beginning of month', today);
    expect(result).toEqual({ day: 1, month: 4, year: 2025 });
  });

  it('resolves "start of month"', () => {
    const result = resolveKeywordToSlots('start of month', today);
    expect(result).toEqual({ day: 1, month: 4, year: 2025 });
  });

  it('resolves "start-of-month"', () => {
    const result = resolveKeywordToSlots('start-of-month', today);
    expect(result).toEqual({ day: 1, month: 4, year: 2025 });
  });

  it('resolves "eoy" to end of year', () => {
    const result = resolveKeywordToSlots('eoy', today);
    expect(result).toEqual({ day: 31, month: 12, year: 2025 });
  });

  it('resolves "end of year"', () => {
    const result = resolveKeywordToSlots('end of year', today);
    expect(result).toEqual({ day: 31, month: 12, year: 2025 });
  });

  it('resolves "end-of-year"', () => {
    const result = resolveKeywordToSlots('end-of-year', today);
    expect(result).toEqual({ day: 31, month: 12, year: 2025 });
  });

  it('resolves "boy" to next year Jan 1 when today is past Jan 1', () => {
    const result = resolveKeywordToSlots('boy', today);
    expect(result).toEqual({ day: 1, month: 1, year: 2026 });
  });

  it('resolves "boy" to current year Jan 1 when today IS Jan 1', () => {
    const janFirst = Temporal.PlainDate.from('2025-01-01');
    const result = resolveKeywordToSlots('boy', janFirst);
    expect(result).toEqual({ day: 1, month: 1, year: 2025 });
  });

  it('resolves "soy" same as boy', () => {
    const result = resolveKeywordToSlots('soy', today);
    expect(result).toEqual({ day: 1, month: 1, year: 2026 });
  });

  it('resolves "beginning of year"', () => {
    const result = resolveKeywordToSlots('beginning of year', today);
    expect(result).toEqual({ day: 1, month: 1, year: 2026 });
  });

  it('resolves "start of year"', () => {
    const result = resolveKeywordToSlots('start of year', today);
    expect(result).toEqual({ day: 1, month: 1, year: 2026 });
  });

  it('resolves "start-of-year"', () => {
    const result = resolveKeywordToSlots('start-of-year', today);
    expect(result).toEqual({ day: 1, month: 1, year: 2026 });
  });

  it('resolves "eoq" to end of Q1 in March', () => {
    const result = resolveKeywordToSlots('eoq', today);
    expect(result).toEqual({ day: 31, month: 3, year: 2025 });
  });

  it('resolves "end of quarter"', () => {
    const result = resolveKeywordToSlots('end of quarter', today);
    expect(result).toEqual({ day: 31, month: 3, year: 2025 });
  });

  it('resolves "end-of-quarter"', () => {
    const result = resolveKeywordToSlots('end-of-quarter', today);
    expect(result).toEqual({ day: 31, month: 3, year: 2025 });
  });

  it('resolves eoq in Q2', () => {
    const april = Temporal.PlainDate.from('2025-04-10');
    const result = resolveKeywordToSlots('eoq', april);
    expect(result).toEqual({ day: 30, month: 6, year: 2025 });
  });

  it('resolves eoq in Q3', () => {
    const july = Temporal.PlainDate.from('2025-07-20');
    const result = resolveKeywordToSlots('eoq', july);
    expect(result).toEqual({ day: 30, month: 9, year: 2025 });
  });

  it('resolves eoq in Q4', () => {
    const october = Temporal.PlainDate.from('2025-10-05');
    const result = resolveKeywordToSlots('eoq', october);
    expect(result).toEqual({ day: 31, month: 12, year: 2025 });
  });

  it('is case insensitive', () => {
    const result = resolveKeywordToSlots('TODAY', today);
    expect(result).toEqual({ day: 15, month: 3, year: 2025 });
  });

  it('returns undefined for unknown keyword', () => {
    expect(resolveKeywordToSlots('invalid', today)).toBeUndefined();
  });

  it('handles yesterday across month boundary', () => {
    const marchFirst = Temporal.PlainDate.from('2025-03-01');
    const result = resolveKeywordToSlots('yesterday', marchFirst);
    expect(result).toEqual({ day: 28, month: 2, year: 2025 });
  });

  it('handles tomorrow across year boundary', () => {
    const dec31 = Temporal.PlainDate.from('2025-12-31');
    const result = resolveKeywordToSlots('tomorrow', dec31);
    expect(result).toEqual({ day: 1, month: 1, year: 2026 });
  });

  it('handles bom at December - wraps to January next year', () => {
    const dec15 = Temporal.PlainDate.from('2025-12-15');
    const result = resolveKeywordToSlots('bom', dec15);
    expect(result).toEqual({ day: 1, month: 1, year: 2026 });
  });
});

describe('resolveNextWeekdayToSlots', () => {
  const wednesday = Temporal.PlainDate.from('2025-03-12');

  it('resolves "mon" to next Monday', () => {
    const result = resolveNextWeekdayToSlots('mon', wednesday);
    expect(result).toEqual({ day: 17, month: 3, year: 2025 });
  });

  it('resolves full name "monday"', () => {
    const result = resolveNextWeekdayToSlots('monday', wednesday);
    expect(result).toEqual({ day: 17, month: 3, year: 2025 });
  });

  it('resolves "fri" to next Friday', () => {
    const result = resolveNextWeekdayToSlots('fri', wednesday);
    expect(result).toEqual({ day: 14, month: 3, year: 2025 });
  });

  it('resolves same weekday to next week (not today)', () => {
    const result = resolveNextWeekdayToSlots('wed', wednesday);
    expect(result).toEqual({ day: 19, month: 3, year: 2025 });
  });

  it('is case insensitive', () => {
    const result = resolveNextWeekdayToSlots('FRIDAY', wednesday);
    expect(result).toEqual({ day: 14, month: 3, year: 2025 });
  });

  it('returns undefined for invalid day name', () => {
    expect(resolveNextWeekdayToSlots('invalid', wednesday)).toBeUndefined();
  });

  it('handles month boundary', () => {
    const march31 = Temporal.PlainDate.from('2025-03-31');
    const result = resolveNextWeekdayToSlots('tue', march31);
    expect(result).toEqual({ day: 1, month: 4, year: 2025 });
  });
});

describe('resolvePreviousWeekdayToSlots', () => {
  const wednesday = Temporal.PlainDate.from('2025-03-12');

  it('resolves "mon" to previous Monday', () => {
    const result = resolvePreviousWeekdayToSlots('mon', wednesday);
    expect(result).toEqual({ day: 10, month: 3, year: 2025 });
  });

  it('resolves "fri" to previous Friday', () => {
    const result = resolvePreviousWeekdayToSlots('fri', wednesday);
    expect(result).toEqual({ day: 7, month: 3, year: 2025 });
  });

  it('resolves same weekday to previous week (not today)', () => {
    const result = resolvePreviousWeekdayToSlots('wed', wednesday);
    expect(result).toEqual({ day: 5, month: 3, year: 2025 });
  });

  it('is case insensitive', () => {
    const result = resolvePreviousWeekdayToSlots('MONDAY', wednesday);
    expect(result).toEqual({ day: 10, month: 3, year: 2025 });
  });

  it('returns undefined for invalid day name', () => {
    expect(resolvePreviousWeekdayToSlots('invalid', wednesday)).toBeUndefined();
  });

  it('handles month boundary backwards', () => {
    const march3 = Temporal.PlainDate.from('2025-03-03');
    const result = resolvePreviousWeekdayToSlots('fri', march3);
    expect(result).toEqual({ day: 28, month: 2, year: 2025 });
  });
});

describe('resolveMonthYearToSlots', () => {
  it('resolves "jan" + 2025', () => {
    expect(resolveMonthYearToSlots('jan', 2025)).toEqual({ day: 1, month: 1, year: 2025 });
  });

  it('resolves full month name "january"', () => {
    expect(resolveMonthYearToSlots('january', 2025)).toEqual({ day: 1, month: 1, year: 2025 });
  });

  it('resolves "dec" + 2024', () => {
    expect(resolveMonthYearToSlots('dec', 2024)).toEqual({ day: 1, month: 12, year: 2024 });
  });

  it('is case insensitive', () => {
    expect(resolveMonthYearToSlots('MAR', 2025)).toEqual({ day: 1, month: 3, year: 2025 });
  });

  it('returns undefined for invalid month name', () => {
    expect(resolveMonthYearToSlots('invalid', 2025)).toBeUndefined();
  });
});

describe('resolveQuarterToSlots', () => {
  it('resolves Q1 to January 1', () => {
    expect(resolveQuarterToSlots(1, 2025)).toEqual({ day: 1, month: 1, year: 2025 });
  });

  it('resolves Q2 to April 1', () => {
    expect(resolveQuarterToSlots(2, 2025)).toEqual({ day: 1, month: 4, year: 2025 });
  });

  it('resolves Q3 to July 1', () => {
    expect(resolveQuarterToSlots(3, 2025)).toEqual({ day: 1, month: 7, year: 2025 });
  });

  it('resolves Q4 to October 1', () => {
    expect(resolveQuarterToSlots(4, 2025)).toEqual({ day: 1, month: 10, year: 2025 });
  });

  it('returns undefined for invalid quarter 0', () => {
    expect(resolveQuarterToSlots(0, 2025)).toBeUndefined();
  });

  it('returns undefined for invalid quarter 5', () => {
    expect(resolveQuarterToSlots(5, 2025)).toBeUndefined();
  });
});

describe('applyOffsetToSlots', () => {
  const today = Temporal.PlainDate.from('2025-03-15');

  it('adds days forward', () => {
    const result = applyOffsetToSlots(today, 5, 'd', 1);
    expect(result).toEqual({ day: 20, month: 3, year: 2025 });
  });

  it('subtracts days backward', () => {
    const result = applyOffsetToSlots(today, 5, 'd', -1);
    expect(result).toEqual({ day: 10, month: 3, year: 2025 });
  });

  it('adds weeks forward', () => {
    const result = applyOffsetToSlots(today, 2, 'w', 1);
    expect(result).toEqual({ day: 29, month: 3, year: 2025 });
  });

  it('subtracts weeks backward', () => {
    const result = applyOffsetToSlots(today, 1, 'w', -1);
    expect(result).toEqual({ day: 8, month: 3, year: 2025 });
  });

  it('adds months forward', () => {
    const result = applyOffsetToSlots(today, 2, 'm', 1);
    expect(result).toEqual({ day: 15, month: 5, year: 2025 });
  });

  it('subtracts months backward', () => {
    const result = applyOffsetToSlots(today, 1, 'm', -1);
    expect(result).toEqual({ day: 15, month: 2, year: 2025 });
  });

  it('adds years forward', () => {
    const result = applyOffsetToSlots(today, 1, 'y', 1);
    expect(result).toEqual({ day: 15, month: 3, year: 2026 });
  });

  it('subtracts years backward', () => {
    const result = applyOffsetToSlots(today, 1, 'y', -1);
    expect(result).toEqual({ day: 15, month: 3, year: 2024 });
  });

  it('handles month boundary crossing', () => {
    const jan31 = Temporal.PlainDate.from('2025-01-31');
    const result = applyOffsetToSlots(jan31, 5, 'd', 1);
    expect(result).toEqual({ day: 5, month: 2, year: 2025 });
  });
});

describe('parseDirectDateToSlots', () => {
  it('parses ISO date YYYY-MM-DD', () => {
    const result = parseDirectDateToSlots('2025-03-15', TIME_ZONE);
    expect(result).toEqual({ day: 15, month: 3, year: 2025 });
  });

  it('parses ISO datetime', () => {
    const result = parseDirectDateToSlots('2025-03-15T14:30:00', TIME_ZONE);
    expect(result).toEqual({
      day: 15,
      month: 3,
      year: 2025,
      hour: 14,
      minute: 30,
      second: 0,
      ms: 0,
    });
  });

  it('parses DD/MM/YYYY format', () => {
    const result = parseDirectDateToSlots('15/03/2025', TIME_ZONE);
    expect(result).toEqual({ day: 15, month: 3, year: 2025 });
  });

  it('parses DD.MM.YYYY format', () => {
    const result = parseDirectDateToSlots('15.03.2025', TIME_ZONE);
    expect(result).toEqual({ day: 15, month: 3, year: 2025 });
  });

  it('parses DD-MM-YYYY format', () => {
    const result = parseDirectDateToSlots('15-03-2025', TIME_ZONE);
    expect(result).toEqual({ day: 15, month: 3, year: 2025 });
  });

  it('returns undefined for invalid input', () => {
    expect(parseDirectDateToSlots('not-a-date', TIME_ZONE)).toBeUndefined();
  });

  it('returns undefined for invalid ISO date', () => {
    expect(parseDirectDateToSlots('2025-13-40', TIME_ZONE)).toBeUndefined();
  });

  it('returns undefined for invalid DD/MM/YYYY', () => {
    expect(parseDirectDateToSlots('32/13/2025', TIME_ZONE)).toBeUndefined();
  });
});

describe('parseStandaloneTimeToSlots', () => {
  it('parses HH:MM', () => {
    const result = parseStandaloneTimeToSlots('14:30');
    expect(result).toEqual({ hour: 14, minute: 30, second: 0, ms: 0 });
  });

  it('parses HH:MM:SS', () => {
    const result = parseStandaloneTimeToSlots('14:30:45');
    expect(result).toEqual({ hour: 14, minute: 30, second: 45, ms: 0 });
  });

  it('parses HH:MM:SS.mmm', () => {
    const result = parseStandaloneTimeToSlots('14:30:45.123');
    expect(result).toEqual({ hour: 14, minute: 30, second: 45, ms: 123 });
  });

  it('parses time with am', () => {
    const result = parseStandaloneTimeToSlots('9am');
    expect(result).toEqual({ hour: 9, minute: 0, second: 0, ms: 0 });
  });

  it('parses time with pm', () => {
    const result = parseStandaloneTimeToSlots('5pm');
    expect(result).toEqual({ hour: 17, minute: 0, second: 0, ms: 0 });
  });

  it('parses 12pm as noon', () => {
    const result = parseStandaloneTimeToSlots('12pm');
    expect(result).toEqual({ hour: 12, minute: 0, second: 0, ms: 0 });
  });

  it('parses 12am as midnight', () => {
    const result = parseStandaloneTimeToSlots('12am');
    expect(result).toEqual({ hour: 0, minute: 0, second: 0, ms: 0 });
  });

  it('parses HH:MM am/pm', () => {
    const result = parseStandaloneTimeToSlots('5:30pm');
    expect(result).toEqual({ hour: 17, minute: 30, second: 0, ms: 0 });
  });

  it('returns undefined for invalid input', () => {
    expect(parseStandaloneTimeToSlots('not-a-time')).toBeUndefined();
  });

  it('returns undefined for invalid hour in am/pm (0am)', () => {
    expect(parseStandaloneTimeToSlots('0am')).toBeUndefined();
  });

  it('returns undefined for invalid hour 25:00', () => {
    expect(parseStandaloneTimeToSlots('25:00')).toBeUndefined();
  });

  it('parses single-digit milliseconds padded', () => {
    const result = parseStandaloneTimeToSlots('14:30:45.1');
    expect(result).toEqual({ hour: 14, minute: 30, second: 45, ms: 100 });
  });
});

describe('resolveKeywordToDateSlots', () => {
  const today = Temporal.PlainDate.from('2025-03-15');

  it('resolves "yesterday" token', () => {
    const token = makeToken({ kind: ETokenKind.Keyword, raw: 'yesterday', value: 0 });
    const result = resolveKeywordToDateSlots(token, today);
    expect(result).toEqual({ day: 14, month: 3, year: 2025 });
  });

  it('resolves "tomorrow" token', () => {
    const token = makeToken({ kind: ETokenKind.Keyword, raw: 'tomorrow', value: 0 });
    const result = resolveKeywordToDateSlots(token, today);
    expect(result).toEqual({ day: 16, month: 3, year: 2025 });
  });

  it('resolves "tom" token', () => {
    const token = makeToken({ kind: ETokenKind.Keyword, raw: 'tom', value: 0 });
    const result = resolveKeywordToDateSlots(token, today);
    expect(result).toEqual({ day: 16, month: 3, year: 2025 });
  });

  it('resolves "today" token', () => {
    const token = makeToken({ kind: ETokenKind.Keyword, raw: 'today', value: 0 });
    const result = resolveKeywordToDateSlots(token, today);
    expect(result).toEqual({ day: 15, month: 3, year: 2025 });
  });

  it('resolves "now" token', () => {
    const token = makeToken({ kind: ETokenKind.Keyword, raw: 'now', value: 0 });
    const result = resolveKeywordToDateSlots(token, today);
    expect(result).toEqual({ day: 15, month: 3, year: 2025 });
  });

  it('resolves weekday token with direction=1 (next)', () => {
    const token = makeToken({
      kind: ETokenKind.Keyword,
      raw: 'next monday',
      value: 1,
      extra: 'weekday:monday',
    });
    const result = resolveKeywordToDateSlots(token, today);
    expect(result).toEqual({ day: 17, month: 3, year: 2025 });
  });

  it('resolves weekday token with direction=-1 (previous)', () => {
    const token = makeToken({
      kind: ETokenKind.Keyword,
      raw: 'last monday',
      value: -1,
      extra: 'weekday:monday',
    });
    const result = resolveKeywordToDateSlots(token, today);
    expect(result).toEqual({ day: 10, month: 3, year: 2025 });
  });

  it('returns undefined for unknown keyword', () => {
    const token = makeToken({ kind: ETokenKind.Keyword, raw: 'invalid', value: 0 });
    expect(resolveKeywordToDateSlots(token, today)).toBeUndefined();
  });
});

describe('resolveTimeKeywordToSlots', () => {
  it('resolves "noon" to 12:00:00.000', () => {
    expect(resolveTimeKeywordToSlots('noon')).toEqual({
      hour: 12,
      minute: 0,
      second: 0,
      ms: 0,
    });
  });

  it('resolves "midday" to 12:00:00.000', () => {
    expect(resolveTimeKeywordToSlots('midday')).toEqual({
      hour: 12,
      minute: 0,
      second: 0,
      ms: 0,
    });
  });

  it('resolves "midnight" to 00:00:00.000', () => {
    expect(resolveTimeKeywordToSlots('midnight')).toEqual({
      hour: 0,
      minute: 0,
      second: 0,
      ms: 0,
    });
  });

  it('returns undefined for unknown keyword', () => {
    expect(resolveTimeKeywordToSlots('evening')).toBeUndefined();
  });
});

describe('resolveBoundaryKeywordToSlots', () => {
  const today = Temporal.PlainDate.from('2025-03-15');

  it('resolves "eom"', () => {
    expect(resolveBoundaryKeywordToSlots('eom', today)).toEqual({
      year: 2025,
      month: 3,
      day: 31,
    });
  });

  it('resolves "end of month"', () => {
    expect(resolveBoundaryKeywordToSlots('end of month', today)).toEqual({
      year: 2025,
      month: 3,
      day: 31,
    });
  });

  it('resolves "end-of-month"', () => {
    expect(resolveBoundaryKeywordToSlots('end-of-month', today)).toEqual({
      year: 2025,
      month: 3,
      day: 31,
    });
  });

  it('resolves "bom" to next month when not 1st', () => {
    expect(resolveBoundaryKeywordToSlots('bom', today)).toEqual({
      year: 2025,
      month: 4,
      day: 1,
    });
  });

  it('resolves "bom" to current day when today is 1st', () => {
    const firstDay = Temporal.PlainDate.from('2025-03-01');
    expect(resolveBoundaryKeywordToSlots('bom', firstDay)).toEqual({
      year: 2025,
      month: 3,
      day: 1,
    });
  });

  it('resolves "som" same as bom', () => {
    expect(resolveBoundaryKeywordToSlots('som', today)).toEqual({
      year: 2025,
      month: 4,
      day: 1,
    });
  });

  it('resolves "beginning of month"', () => {
    expect(resolveBoundaryKeywordToSlots('beginning of month', today)).toEqual({
      year: 2025,
      month: 4,
      day: 1,
    });
  });

  it('resolves "start of month"', () => {
    expect(resolveBoundaryKeywordToSlots('start of month', today)).toEqual({
      year: 2025,
      month: 4,
      day: 1,
    });
  });

  it('resolves "start-of-month"', () => {
    expect(resolveBoundaryKeywordToSlots('start-of-month', today)).toEqual({
      year: 2025,
      month: 4,
      day: 1,
    });
  });

  it('resolves "eoy"', () => {
    expect(resolveBoundaryKeywordToSlots('eoy', today)).toEqual({
      year: 2025,
      month: 12,
      day: 31,
    });
  });

  it('resolves "end of year"', () => {
    expect(resolveBoundaryKeywordToSlots('end of year', today)).toEqual({
      year: 2025,
      month: 12,
      day: 31,
    });
  });

  it('resolves "end-of-year"', () => {
    expect(resolveBoundaryKeywordToSlots('end-of-year', today)).toEqual({
      year: 2025,
      month: 12,
      day: 31,
    });
  });

  it('resolves "boy" to next year when past Jan 1', () => {
    expect(resolveBoundaryKeywordToSlots('boy', today)).toEqual({
      year: 2026,
      month: 1,
      day: 1,
    });
  });

  it('resolves "boy" to current year on Jan 1', () => {
    const janFirst = Temporal.PlainDate.from('2025-01-01');
    expect(resolveBoundaryKeywordToSlots('boy', janFirst)).toEqual({
      year: 2025,
      month: 1,
      day: 1,
    });
  });

  it('resolves "soy" same as boy', () => {
    expect(resolveBoundaryKeywordToSlots('soy', today)).toEqual({
      year: 2026,
      month: 1,
      day: 1,
    });
  });

  it('resolves "beginning of year"', () => {
    expect(resolveBoundaryKeywordToSlots('beginning of year', today)).toEqual({
      year: 2026,
      month: 1,
      day: 1,
    });
  });

  it('resolves "start of year"', () => {
    expect(resolveBoundaryKeywordToSlots('start of year', today)).toEqual({
      year: 2026,
      month: 1,
      day: 1,
    });
  });

  it('resolves "start-of-year"', () => {
    expect(resolveBoundaryKeywordToSlots('start-of-year', today)).toEqual({
      year: 2026,
      month: 1,
      day: 1,
    });
  });

  it('resolves "eoq" to end of Q1 in March', () => {
    expect(resolveBoundaryKeywordToSlots('eoq', today)).toEqual({
      year: 2025,
      month: 3,
      day: 31,
    });
  });

  it('resolves "end of quarter" in Q2', () => {
    const april = Temporal.PlainDate.from('2025-04-10');
    expect(resolveBoundaryKeywordToSlots('end of quarter', april)).toEqual({
      year: 2025,
      month: 6,
      day: 30,
    });
  });

  it('resolves "end-of-quarter" in Q4', () => {
    const october = Temporal.PlainDate.from('2025-10-05');
    expect(resolveBoundaryKeywordToSlots('end-of-quarter', october)).toEqual({
      year: 2025,
      month: 12,
      day: 31,
    });
  });

  it('returns undefined for unknown keyword', () => {
    expect(resolveBoundaryKeywordToSlots('invalid', today)).toBeUndefined();
  });
});

describe('resolveQuarterFromToken', () => {
  const today = Temporal.PlainDate.from('2025-03-15');

  it('resolves Q1 with explicit year token', () => {
    const quarterToken = makeToken({ kind: ETokenKind.Quarter, raw: 'Q1', value: 1 });
    const yearToken = makeToken({ kind: ETokenKind.Number, raw: '2025', value: 2025 });
    const result = resolveQuarterFromToken(quarterToken, [quarterToken, yearToken], today);
    expect(result?.toString()).toBe('2025-01-01');
  });

  it('resolves Q2 with explicit year token', () => {
    const quarterToken = makeToken({ kind: ETokenKind.Quarter, raw: 'Q2', value: 2 });
    const yearToken = makeToken({ kind: ETokenKind.Number, raw: '2024', value: 2024 });
    const result = resolveQuarterFromToken(quarterToken, [quarterToken, yearToken], today);
    expect(result?.toString()).toBe('2024-04-01');
  });

  it('resolves Q1 without year - future quarter stays current year', () => {
    const jan = Temporal.PlainDate.from('2024-12-15');
    const quarterToken = makeToken({ kind: ETokenKind.Quarter, raw: 'Q1', value: 1 });
    const result = resolveQuarterFromToken(quarterToken, [quarterToken], jan);
    expect(result?.toString()).toBe('2025-01-01');
  });

  it('resolves past quarter without year to next year', () => {
    const quarterToken = makeToken({ kind: ETokenKind.Quarter, raw: 'Q1', value: 1 });
    const result = resolveQuarterFromToken(quarterToken, [quarterToken], today);
    expect(result?.toString()).toBe('2026-01-01');
  });

  it('returns undefined for invalid quarter value', () => {
    const quarterToken = makeToken({ kind: ETokenKind.Quarter, raw: 'Q5', value: 5 });
    const result = resolveQuarterFromToken(quarterToken, [quarterToken], today);
    expect(result).toBeUndefined();
  });
});

describe('tryResolveKeyword', () => {
  const today = Temporal.PlainDate.from('2025-03-15');

  it('resolves "yesterday" to ZonedDateTime', () => {
    const result = tryResolveKeyword('yesterday', today, TIME_ZONE);
    expect(result?.toPlainDate().toString()).toBe('2025-03-14');
  });

  it('resolves "tomorrow" to ZonedDateTime', () => {
    const result = tryResolveKeyword('tomorrow', today, TIME_ZONE);
    expect(result?.toPlainDate().toString()).toBe('2025-03-16');
  });

  it('resolves "tom" to ZonedDateTime', () => {
    const result = tryResolveKeyword('tom', today, TIME_ZONE);
    expect(result?.toPlainDate().toString()).toBe('2025-03-16');
  });

  it('resolves "today" to ZonedDateTime', () => {
    const result = tryResolveKeyword('today', today, TIME_ZONE);
    expect(result?.toPlainDate().toString()).toBe('2025-03-15');
  });

  it('resolves "now" to ZonedDateTime', () => {
    const result = tryResolveKeyword('now', today, TIME_ZONE);
    expect(result?.toPlainDate().toString()).toBe('2025-03-15');
  });

  it('resolves "noon" with time 12:00', () => {
    const result = tryResolveKeyword('noon', today, TIME_ZONE);
    expect(result?.toPlainDate().toString()).toBe('2025-03-15');
    expect(result?.hour).toBe(12);
  });

  it('resolves "midday" with time 12:00', () => {
    const result = tryResolveKeyword('midday', today, TIME_ZONE);
    expect(result?.hour).toBe(12);
  });

  it('resolves "midnight" at 00:00', () => {
    const result = tryResolveKeyword('midnight', today, TIME_ZONE);
    expect(result?.toPlainDate().toString()).toBe('2025-03-15');
    expect(result?.hour).toBe(0);
  });

  it('resolves "eom"', () => {
    const result = tryResolveKeyword('eom', today, TIME_ZONE);
    expect(result?.toPlainDate().toString()).toBe('2025-03-31');
  });

  it('resolves "end of month"', () => {
    const result = tryResolveKeyword('end of month', today, TIME_ZONE);
    expect(result?.toPlainDate().toString()).toBe('2025-03-31');
  });

  it('resolves "end-of-month"', () => {
    const result = tryResolveKeyword('end-of-month', today, TIME_ZONE);
    expect(result?.toPlainDate().toString()).toBe('2025-03-31');
  });

  it('resolves "bom" to next month when past 1st', () => {
    const result = tryResolveKeyword('bom', today, TIME_ZONE);
    expect(result?.toPlainDate().toString()).toBe('2025-04-01');
  });

  it('resolves "bom" to current month on 1st', () => {
    const firstDay = Temporal.PlainDate.from('2025-03-01');
    const result = tryResolveKeyword('bom', firstDay, TIME_ZONE);
    expect(result?.toPlainDate().toString()).toBe('2025-03-01');
  });

  it('resolves "som"', () => {
    const result = tryResolveKeyword('som', today, TIME_ZONE);
    expect(result?.toPlainDate().toString()).toBe('2025-04-01');
  });

  it('resolves "beginning of month"', () => {
    const result = tryResolveKeyword('beginning of month', today, TIME_ZONE);
    expect(result?.toPlainDate().toString()).toBe('2025-04-01');
  });

  it('resolves "start of month"', () => {
    const result = tryResolveKeyword('start of month', today, TIME_ZONE);
    expect(result?.toPlainDate().toString()).toBe('2025-04-01');
  });

  it('resolves "start-of-month"', () => {
    const result = tryResolveKeyword('start-of-month', today, TIME_ZONE);
    expect(result?.toPlainDate().toString()).toBe('2025-04-01');
  });

  it('resolves "eoy"', () => {
    const result = tryResolveKeyword('eoy', today, TIME_ZONE);
    expect(result?.toPlainDate().toString()).toBe('2025-12-31');
  });

  it('resolves "end of year"', () => {
    const result = tryResolveKeyword('end of year', today, TIME_ZONE);
    expect(result?.toPlainDate().toString()).toBe('2025-12-31');
  });

  it('resolves "end-of-year"', () => {
    const result = tryResolveKeyword('end-of-year', today, TIME_ZONE);
    expect(result?.toPlainDate().toString()).toBe('2025-12-31');
  });

  it('resolves "boy" to next year when past Jan 1', () => {
    const result = tryResolveKeyword('boy', today, TIME_ZONE);
    expect(result?.toPlainDate().toString()).toBe('2026-01-01');
  });

  it('resolves "boy" to current year on Jan 1', () => {
    const janFirst = Temporal.PlainDate.from('2025-01-01');
    const result = tryResolveKeyword('boy', janFirst, TIME_ZONE);
    expect(result?.toPlainDate().toString()).toBe('2025-01-01');
  });

  it('resolves "soy"', () => {
    const result = tryResolveKeyword('soy', today, TIME_ZONE);
    expect(result?.toPlainDate().toString()).toBe('2026-01-01');
  });

  it('resolves "beginning of year"', () => {
    const result = tryResolveKeyword('beginning of year', today, TIME_ZONE);
    expect(result?.toPlainDate().toString()).toBe('2026-01-01');
  });

  it('resolves "start of year"', () => {
    const result = tryResolveKeyword('start of year', today, TIME_ZONE);
    expect(result?.toPlainDate().toString()).toBe('2026-01-01');
  });

  it('resolves "start-of-year"', () => {
    const result = tryResolveKeyword('start-of-year', today, TIME_ZONE);
    expect(result?.toPlainDate().toString()).toBe('2026-01-01');
  });

  it('resolves "eoq" to end of Q1', () => {
    const result = tryResolveKeyword('eoq', today, TIME_ZONE);
    expect(result?.toPlainDate().toString()).toBe('2025-03-31');
  });

  it('resolves "end of quarter"', () => {
    const result = tryResolveKeyword('end of quarter', today, TIME_ZONE);
    expect(result?.toPlainDate().toString()).toBe('2025-03-31');
  });

  it('resolves "end-of-quarter"', () => {
    const result = tryResolveKeyword('end-of-quarter', today, TIME_ZONE);
    expect(result?.toPlainDate().toString()).toBe('2025-03-31');
  });

  it('is case insensitive', () => {
    const result = tryResolveKeyword('TODAY', today, TIME_ZONE);
    expect(result?.toPlainDate().toString()).toBe('2025-03-15');
  });

  it('returns undefined for unknown keyword', () => {
    expect(tryResolveKeyword('invalid', today, TIME_ZONE)).toBeUndefined();
  });

  it('uses correct time zone', () => {
    const result = tryResolveKeyword('today', today, 'America/New_York');
    expect(result?.timeZoneId).toBe('America/New_York');
  });
});

describe('tryParseStandaloneTimeSlots', () => {
  it('parses HH:MM', () => {
    expect(tryParseStandaloneTimeSlots('14:30')).toEqual({
      hour: 14,
      minute: 30,
      second: 0,
      ms: 0,
    });
  });

  it('parses HH:MM:SS', () => {
    expect(tryParseStandaloneTimeSlots('9:05:30')).toEqual({
      hour: 9,
      minute: 5,
      second: 30,
      ms: 0,
    });
  });

  it('parses HH:MM:SS.mmm', () => {
    expect(tryParseStandaloneTimeSlots('14:30:45.123')).toEqual({
      hour: 14,
      minute: 30,
      second: 45,
      ms: 123,
    });
  });

  it('parses am/pm time', () => {
    expect(tryParseStandaloneTimeSlots('3pm')).toEqual({
      hour: 15,
      minute: 0,
      second: 0,
      ms: 0,
    });
  });

  it('parses am/pm with minutes', () => {
    expect(tryParseStandaloneTimeSlots('3:30pm')).toEqual({
      hour: 15,
      minute: 30,
      second: 0,
      ms: 0,
    });
  });

  it('returns undefined for invalid input', () => {
    expect(tryParseStandaloneTimeSlots('abc')).toBeUndefined();
  });

  it('returns undefined for 13pm (invalid am/pm hour)', () => {
    expect(tryParseStandaloneTimeSlots('13pm')).toBeUndefined();
  });
});

describe('tryParseISOSlots', () => {
  it('parses ISO date', () => {
    expect(tryParseISOSlots('2025-03-15', TIME_ZONE)).toEqual({
      day: 15,
      month: 3,
      year: 2025,
    });
  });

  it('parses ISO datetime', () => {
    expect(tryParseISOSlots('2025-03-15T14:30:00', TIME_ZONE)).toEqual({
      day: 15,
      month: 3,
      year: 2025,
      hour: 14,
      minute: 30,
      second: 0,
      ms: 0,
    });
  });

  it('parses ISO datetime with seconds and ms', () => {
    expect(tryParseISOSlots('2025-03-15T14:30:45.123', TIME_ZONE)).toEqual({
      day: 15,
      month: 3,
      year: 2025,
      hour: 14,
      minute: 30,
      second: 45,
      ms: 123,
    });
  });

  it('returns undefined for invalid ISO date', () => {
    expect(tryParseISOSlots('2025-13-40', TIME_ZONE)).toBeUndefined();
  });

  it('returns undefined for non-ISO input', () => {
    expect(tryParseISOSlots('15/03/2025', TIME_ZONE)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(tryParseISOSlots('', TIME_ZONE)).toBeUndefined();
  });
});

describe('tryParseDirectDateSlots', () => {
  it('parses DD/MM/YYYY', () => {
    expect(tryParseDirectDateSlots('15/03/2025')).toEqual({
      day: 15,
      month: 3,
      year: 2025,
    });
  });

  it('parses D/M/YYYY (single digit day/month)', () => {
    expect(tryParseDirectDateSlots('5/3/2025')).toEqual({
      day: 5,
      month: 3,
      year: 2025,
    });
  });

  it('parses DD.MM.YYYY', () => {
    expect(tryParseDirectDateSlots('15.03.2025')).toEqual({
      day: 15,
      month: 3,
      year: 2025,
    });
  });

  it('parses DD-MM-YYYY', () => {
    expect(tryParseDirectDateSlots('15-03-2025')).toEqual({
      day: 15,
      month: 3,
      year: 2025,
    });
  });

  it('returns undefined for invalid date', () => {
    expect(tryParseDirectDateSlots('32/13/2025')).toBeUndefined();
  });

  it('returns undefined for non-date input', () => {
    expect(tryParseDirectDateSlots('hello')).toBeUndefined();
  });

  it('returns undefined for ISO format (not DD-MM-YYYY)', () => {
    expect(tryParseDirectDateSlots('2025-03-15')).toBeUndefined();
  });
});
