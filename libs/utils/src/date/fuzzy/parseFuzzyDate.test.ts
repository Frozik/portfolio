import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';
import type { IParseFuzzyDateOptions } from './parseFuzzyDate';
import { parseFuzzyDate } from './parseFuzzyDate';
import type { DateTimeParseResult } from './types';

function askedAt(moment: Temporal.ZonedDateTime): IParseFuzzyDateOptions {
  return { now: moment.toInstant(), timeZone: moment.timeZoneId };
}

describe('parseFuzzyDate', () => {
  const now = Temporal.PlainDate.from('2024-06-15').toZonedDateTime('UTC'); // Saturday at midnight

  function parse(input: string): DateTimeParseResult {
    return parseFuzzyDate(input, askedAt(now));
  }

  function expectDate(input: string, expected: string): void {
    const result = parse(input);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.toPlainDate().toString()).toBe(expected);
    }
  }

  function expectDateTime(
    input: string,
    expectedDate: string,
    expectedHour: number,
    expectedMinute: number,
    expectedSecond = 0,
    expectedMs = 0
  ): void {
    const result = parse(input);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.toPlainDate().toString()).toBe(expectedDate);
      expect(result.value.hour).toBe(expectedHour);
      expect(result.value.minute).toBe(expectedMinute);
      expect(result.value.second).toBe(expectedSecond);
      expect(result.value.millisecond).toBe(expectedMs);
    }
  }

  describe('date-only', () => {
    it.each([
      // keywords
      ['today', '2024-06-15'],
      ['tomorrow', '2024-06-16'],
      ['yesterday', '2024-06-14'],
      // boundary keywords
      ['eom', '2024-06-30'],
      ['bom', '2024-07-01'],
      ['eoy', '2024-12-31'],
      ['boy', '2025-01-01'],
      ['eoq', '2024-06-30'],
      // offsets
      ['+3d', '2024-06-18'],
      ['-1w', '2024-06-08'],
      ['+2m', '2024-08-15'],
      ['+1y', '2025-06-15'],
      ['3w', '2024-07-06'],
      ['1d', '2024-06-16'],
      ['1m', '2024-07-15'],
      ['1y', '2025-06-15'],
      ['2w', '2024-06-29'],
      ['in 3 days', '2024-06-18'],
      ['in 2 weeks', '2024-06-29'],
      ['in 1 month', '2024-07-15'],
      ['3 days ago', '2024-06-12'],
      ['2 weeks ago', '2024-06-01'],
      ['1 year ago', '2023-06-15'],
      // weekdays
      ['mon', '2024-06-17'],
      ['tuesday', '2024-06-18'],
      ['next monday', '2024-06-17'],
      ['next friday', '2024-06-21'],
      ['last monday', '2024-06-10'],
      ['last friday', '2024-06-14'],
      // date with month name
      ['15 jan 2025', '2025-01-15'],
      ['15th january 2025', '2025-01-15'],
      ['jan 15 2025', '2025-01-15'],
      ['jan 15, 2025', '2025-01-15'],
      ['january 1st, 2025', '2025-01-01'],
      ["15 jan '25", '2025-01-15'],
      ['15 jan 27', '2027-01-15'],
      ['jan 15 27', '2027-01-15'],
      ['15 jan', '2025-01-15'],
      ['jan 15', '2025-01-15'],
      ['15th december', '2024-12-15'],
      ['1 jul', '2024-07-01'],
      ['10nov', '2024-11-10'],
      ['1jan', '2025-01-01'],
      ['January20', '2025-01-20'],
      ['nov10', '2024-11-10'],
      ['dec25', '2024-12-25'],
      ['15nov2025', '2025-11-15'],
      ['January20 2025', '2025-01-20'],
      // numeric dates
      ['2024-06-01', '2024-06-01'],
      ['15/03/2024', '2024-03-15'],
      ['15.03.2024', '2024-03-15'],
      ['15 06 27', '2027-06-15'],
      ['15 06 2027', '2027-06-15'],
      ['1 1 25', '2025-01-01'],
      // quarters
      ['Q1', '2025-01-01'],
      ['Q2 2025', '2025-04-01'],
      ['Q3/2025', '2025-07-01'],
      ['1Q25', '2025-01-01'],
      ['4Q2025', '2025-10-01'],
      // month + year
      ['jan 2027', '2027-01-01'],
      ['january 2027', '2027-01-01'],
      ['2027 jan', '2027-01-01'],
      ["jan '27", '2027-01-01'],
      ['2027-01', '2027-01-01'],
      ['01/2027', '2027-01-01'],
      // month only
      ['jan', '2025-01-01'],
      ['december', '2024-12-01'],
      // ordinals
      ['15th', '2024-06-15'],
      ['the 1st', '2024-07-01'],
      ['22nd', '2024-06-22'],
      // ambiguous year vs hour (year case)
      ['10 nov 82', '1982-11-10'],
    ])('parses "%s" → %s', expectDate);
  });

  describe('date+time', () => {
    it.each([
      // standalone time
      ['13:00', '2024-06-15', 13, 0],
      ['00:30', '2024-06-15', 0, 30],
      ['9:30:45', '2024-06-15', 9, 30, 45],
      ['9:30:45.123', '2024-06-15', 9, 30, 45, 123],
      ['9am', '2024-06-15', 9, 0],
      ['2pm', '2024-06-15', 14, 0],
      ['12am', '2024-06-15', 0, 0],
      ['12pm', '2024-06-15', 12, 0],
      ['5:30pm', '2024-06-15', 17, 30],
      ['noon', '2024-06-15', 12, 0],
      ['midnight', '2024-06-15', 0, 0],
      // keyword + time
      ['tom 13:00', '2024-06-16', 13, 0],
      ['tom 13:00:30', '2024-06-16', 13, 0, 30],
      ['tom 13:00:30.900', '2024-06-16', 13, 0, 30, 900],
      ['tomorrow 9am', '2024-06-16', 9, 0],
      ['yesterday 23:00', '2024-06-14', 23, 0],
      ['today 15:30', '2024-06-15', 15, 30],
      ['eom 23:59', '2024-06-30', 23, 59],
      // weekday + time
      ['mon 9:30', '2024-06-17', 9, 30],
      ['mon 2pm', '2024-06-17', 14, 0],
      ['fri 5:30pm', '2024-06-21', 17, 30],
      ['next fri 17:00', '2024-06-21', 17, 0],
      ['last mon 9am', '2024-06-10', 9, 0],
      // offset + time
      ['+3d 8:00', '2024-06-18', 8, 0],
      ['+1w 9:00', '2024-06-22', 9, 0],
      ['-2d 18:00', '2024-06-13', 18, 0],
      ['in 3 days 8am', '2024-06-18', 8, 0],
      ['in 10 days 22', '2024-06-25', 22, 0],
      // date with month name + time
      ['15 jan 2025 14:30:00', '2025-01-15', 14, 30],
      ['15 dec 2024 8:15', '2024-12-15', 8, 15],
      ['1 jul 9am', '2024-07-01', 9, 0],
      ['jan 10 17', '2025-01-10', 17, 0],
      // numeric date + time
      ['15.03.2024 18:00', '2024-03-15', 18, 0],
      ['15/03/2024 18:00', '2024-03-15', 18, 0],
      ['2025-01-15 9:30:45.123', '2025-01-15', 9, 30, 45, 123],
      ['2024-01-15T14:30', '2024-01-15', 14, 30],
      // ambiguous year vs hour
      ['10 nov 10', '2024-11-10', 10, 0],
      ['10 nov 82 10', '1982-11-10', 10, 0],
      ['10 nov 10 40', '2024-11-10', 10, 40],
      ['10 nov 2082 10:40', '2082-11-10', 10, 40],
      // concatenated month with time
      ['10nov 82 10 40', '1982-11-10', 10, 40],
      ['11 10 10nov', '2024-11-10', 11, 10],
      // separator-delimited date+time
      ['2026-04-13 10:10 55 900', '2026-04-13', 10, 10, 55, 900],
      ['2025-01-15 9:30 45', '2025-01-15', 9, 30, 45],
      // ordinal + hour
      ['15th 22', '2024-06-15', 22, 0],
      ['the 1st 9', '2024-07-01', 9, 0],
      ['22nd 14', '2024-06-22', 14, 0],
      // concatenated month + time components
      ['10nov 11 17', '2024-11-10', 11, 17],
      ['nov10 11 17', '2024-11-10', 11, 17],
      ['1jan 8', '2025-01-01', 8, 0],
      ['dec25 18 30', '2024-12-25', 18, 30],
      // keyword + bare hour
      ['today 22', '2024-06-15', 22, 0],
      ['tomorrow 8', '2024-06-16', 8, 0],
      ['yesterday 17', '2024-06-14', 17, 0],
      ['tom 9', '2024-06-16', 9, 0],
      // keyword + hour + minute
      ['today 10 30', '2024-06-15', 10, 30],
      ['tomorrow 22 45', '2024-06-16', 22, 45],
      // keyword + glued hour (no space)
      ['yesterday10', '2024-06-14', 10, 0],
      ['tom9', '2024-06-16', 9, 0],
      ['today14', '2024-06-15', 14, 0],
      ['mon14', '2024-06-17', 14, 0],
      ['friday18', '2024-06-21', 18, 0],
      // boundary + bare hour
      ['eom 14', '2024-06-30', 14, 0],
      ['bom 9', '2024-07-01', 9, 0],
      ['eoy 23', '2024-12-31', 23, 0],
      // boundary + hour + minute
      ['eom 14 30', '2024-06-30', 14, 30],
      // weekday + bare hour
      ['mon 14', '2024-06-17', 14, 0],
      ['tuesday 9', '2024-06-18', 9, 0],
      ['next friday 18', '2024-06-21', 18, 0],
      ['last monday 7', '2024-06-10', 7, 0],
      // weekday + hour + minute
      ['mon 14 30', '2024-06-17', 14, 30],
      ['friday 9 15', '2024-06-21', 9, 15],
      // offset + bare hour
      ['+1d 15', '2024-06-16', 15, 0],
      ['-3d 8', '2024-06-12', 8, 0],
      ['2w 10', '2024-06-29', 10, 0],
      ['in 1 week 9', '2024-06-22', 9, 0],
      ['3 days ago 18', '2024-06-12', 18, 0],
      // offset + hour + minute
      ['+2d 14 30', '2024-06-17', 14, 30],
      ['in 5 days 9 45', '2024-06-20', 9, 45],
      // date with month name + bare hour
      ['15 jan 2025 8', '2025-01-15', 8, 0],
      ['jan 10 22', '2025-01-10', 22, 0],
      // date with month name + hour + minute
      ['15 jan 2025 8 30', '2025-01-15', 8, 30],
      ['1 jul 14 45', '2024-07-01', 14, 45],
      // numeric date + bare hour
      ['15 06 2027 10', '2027-06-15', 10, 0],
      // month + year (no time — date only cases covered above)
      // quarter + time
      ['Q1 2025 9', '2025-01-01', 9, 0],
    ] as const)('parses "%s" → %s %d:%d', expectDateTime);
  });

  describe('failure cases', () => {
    it.each(['', 'gibberish'])('returns failure for "%s"', input => {
      expect(parse(input).success).toBe(false);
    });
  });

  describe('ensure future', () => {
    const nowAt14 = Temporal.ZonedDateTime.from('2024-06-15T14:00:00[UTC]');

    function parseAt14(input: string): DateTimeParseResult {
      return parseFuzzyDate(input, askedAt(nowAt14));
    }

    function expectDateAt14(input: string, expected: string): void {
      const result = parseAt14(input);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.toPlainDate().toString()).toBe(expected);
      }
    }

    function expectDateTimeAt14(
      input: string,
      expectedDate: string,
      expectedHour: number,
      expectedMinute: number
    ): void {
      const result = parseAt14(input);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.toPlainDate().toString()).toBe(expectedDate);
        expect(result.value.hour).toBe(expectedHour);
        expect(result.value.minute).toBe(expectedMinute);
      }
    }

    describe('standalone time', () => {
      it.each([
        ['13:00', '2024-06-16', 13, 0],
        ['15:00', '2024-06-15', 15, 0],
        ['00:30', '2024-06-16', 0, 30],
        ['9am', '2024-06-16', 9, 0],
        ['3pm', '2024-06-15', 15, 0],
      ] as const)('parses "%s" → %s %d:%d', expectDateTimeAt14);
    });

    describe('keyword time', () => {
      it.each([
        ['noon', '2024-06-16', 12, 0],
        ['midnight', '2024-06-16', 0, 0],
      ] as const)('parses "%s" → %s %d:%d', expectDateTimeAt14);
    });

    describe('weekday + time', () => {
      const nowTue14 = Temporal.ZonedDateTime.from('2024-06-18T14:00:00[UTC]');

      function parseTue14(input: string): DateTimeParseResult {
        return parseFuzzyDate(input, askedAt(nowTue14));
      }

      it.each([
        ['tue 13:00', '2024-06-25', 13, 0],
        ['tue 15:00', '2024-06-25', 15, 0],
      ] as const)('parses "%s" → %s %d:%d', (input, expectedDate, expectedHour, expectedMinute) => {
        const result = parseTue14(input);
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.value.toPlainDate().toString()).toBe(expectedDate);
          expect(result.value.hour).toBe(expectedHour);
          expect(result.value.minute).toBe(expectedMinute);
        }
      });

      it('parses "mon" → 2024-06-17', () => expectDateAt14('mon', '2024-06-17'));
    });

    it.each([
      ['15th', '2024-07-15'],
      ['22nd', '2024-06-22'],
      ['jan 15', '2025-01-15'],
      ['jun 14', '2025-06-14'],
      ['yesterday', '2024-06-14'],
      ['-2d', '2024-06-13'],
      ['last monday', '2024-06-10'],
      ['3 days ago', '2024-06-12'],
      ['2024-01-15', '2024-01-15'],
      ['15/03/2024', '2024-03-15'],
      ['tomorrow', '2024-06-16'],
      ['+3d', '2024-06-18'],
      ['in 2 weeks', '2024-06-29'],
      ['eom', '2024-06-30'],
    ])('parses "%s" → %s', expectDateAt14);

    it.each([
      ['today 13:00', '2024-06-15', 13, 0],
      ['eom 23:59', '2024-06-30', 23, 59],
      ['tom 13:00', '2024-06-16', 13, 0],
    ] as const)('parses "%s" → %s %d:%d', expectDateTimeAt14);
  });

  describe('nearest mode (nearest=true skips ensure-future)', () => {
    const nowAt14 = Temporal.ZonedDateTime.from('2024-06-15T14:00:00[UTC]');

    function parseNearest(input: string): DateTimeParseResult {
      return parseFuzzyDate(input, { ...askedAt(nowAt14), nearest: true });
    }

    function expectNearestDate(input: string, expected: string): void {
      const result = parseNearest(input);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.toPlainDate().toString()).toBe(expected);
      }
    }

    function expectNearestDateTime(
      input: string,
      expectedDate: string,
      expectedHour: number,
      expectedMinute: number
    ): void {
      const result = parseNearest(input);
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.toPlainDate().toString()).toBe(expectedDate);
        expect(result.value.hour).toBe(expectedHour);
        expect(result.value.minute).toBe(expectedMinute);
      }
    }

    it.each([
      ['13:00', '2024-06-15', 13, 0],
      ['9am', '2024-06-15', 9, 0],
      ['noon', '2024-06-15', 12, 0],
      ['midnight', '2024-06-15', 0, 0],
      ['15:00', '2024-06-15', 15, 0],
    ] as const)('parses "%s" → %s %d:%d', expectNearestDateTime);

    it.each([
      ['15th', '2024-06-15'],
      ['yesterday', '2024-06-14'],
      ['tomorrow', '2024-06-16'],
      ['+3d', '2024-06-18'],
      ['2024-01-15', '2024-01-15'],
    ])('parses "%s" → %s', expectNearestDate);
  });
});

describe('parseFuzzyDate — the examples the Controls page documents', () => {
  const saturdayMidnight = Temporal.ZonedDateTime.from('2024-06-15T00:00:00[UTC]');

  it.each([
    // keywords
    ['today', '2024-06-15T00:00:00'],
    ['tomorrow', '2024-06-16T00:00:00'],
    ['tom', '2024-06-16T00:00:00'],
    ['yesterday', '2024-06-14T00:00:00'],
    ['day after tomorrow', '2024-06-17T00:00:00'],
    ['tonight', '2024-06-15T20:00:00'],
    ['tomorrow morning', '2024-06-16T09:00:00'],
    ['now', '2024-06-15T00:00:00'],
    ['noon', '2024-06-15T12:00:00'],
    ['midday', '2024-06-15T12:00:00'],
    ['midnight', '2024-06-15T00:00:00'],
    // boundaries
    ['eom', '2024-06-30T00:00:00'],
    ['bom', '2024-07-01T00:00:00'],
    ['eoy', '2024-12-31T00:00:00'],
    ['boy', '2025-01-01T00:00:00'],
    ['eoq', '2024-06-30T00:00:00'],
    ['eow', '2024-06-16T00:00:00'],
    ['bow', '2024-06-17T00:00:00'],
    ['eod', '2024-06-15T23:59:59.999'],
    ['end of month', '2024-06-30T00:00:00'],
    ['start of year', '2025-01-01T00:00:00'],
    ['end of next month', '2024-07-31T00:00:00'],
    // weekdays
    ['mon', '2024-06-17T00:00:00'],
    ['tue', '2024-06-18T00:00:00'],
    ['wed', '2024-06-19T00:00:00'],
    ['thu', '2024-06-20T00:00:00'],
    ['fri', '2024-06-21T00:00:00'],
    ['sat', '2024-06-22T00:00:00'],
    ['sun', '2024-06-16T00:00:00'],
    ['monday', '2024-06-17T00:00:00'],
    ['tuesday', '2024-06-18T00:00:00'],
    ['wednesday', '2024-06-19T00:00:00'],
    ['thursday', '2024-06-20T00:00:00'],
    ['friday', '2024-06-21T00:00:00'],
    ['saturday', '2024-06-22T00:00:00'],
    ['sunday', '2024-06-16T00:00:00'],
    ['next fri', '2024-06-21T00:00:00'],
    ['this fri', '2024-06-21T00:00:00'],
    ['next weekend', '2024-06-22T00:00:00'],
    ['last monday', '2024-06-10T00:00:00'],
    ['wed 15 jan 2025', '2025-01-15T00:00:00'],
    // offsets
    ['+3d', '2024-06-18T00:00:00'],
    ['-1w', '2024-06-08T00:00:00'],
    ['2m', '2024-08-15T00:00:00'],
    ['1y', '2025-06-15T00:00:00'],
    ['in 3 days', '2024-06-18T00:00:00'],
    ['2 weeks ago', '2024-06-01T00:00:00'],
    ['+4h', '2024-06-15T04:00:00'],
    ['in 2 hours', '2024-06-15T02:00:00'],
    ['30min', '2024-06-15T00:30:00'],
    ['30s', '2024-06-15T00:00:30'],
    ['1h30min', '2024-06-15T01:30:00'],
    ['1.5h', '2024-06-15T01:30:00'],
    ['in an hour', '2024-06-15T01:00:00'],
    ['a week ago', '2024-06-08T00:00:00'],
    ['next week', '2024-06-22T00:00:00'],
    // dates
    ['2025-01-15', '2025-01-15T00:00:00'],
    ['15/03/2025', '2025-03-15T00:00:00'],
    ['15.03.2025', '2025-03-15T00:00:00'],
    ['15 jan 2025', '2025-01-15T00:00:00'],
    ['jan 15 25', '2025-01-15T00:00:00'],
    ['15 06 27', '2027-06-15T00:00:00'],
    ['10nov', '2024-11-10T00:00:00'],
    ['nov10', '2024-11-10T00:00:00'],
    ['15nov2025', '2025-11-15T00:00:00'],
    ['sept 15', '2024-09-15T00:00:00'],
    ['1st of january', '2025-01-01T00:00:00'],
    // months
    ['jan', '2025-01-01T00:00:00'],
    ['december', '2024-12-01T00:00:00'],
    ['january 2027', '2027-01-01T00:00:00'],
    ["jan '27", '2027-01-01T00:00:00'],
    ['2027-01', '2027-01-01T00:00:00'],
    ['01/2027', '2027-01-01T00:00:00'],
    ['2027 jan', '2027-01-01T00:00:00'],
    // quarters
    ['Q1', '2025-01-01T00:00:00'],
    ['Q2 2025', '2025-04-01T00:00:00'],
    ['Q3/2025', '2025-07-01T00:00:00'],
    ['1Q25', '2025-01-01T00:00:00'],
    ['4Q2025', '2025-10-01T00:00:00'],
    // ordinals
    ['15th', '2024-06-15T00:00:00'],
    ['the 1st', '2024-07-01T00:00:00'],
    ['22nd', '2024-06-22T00:00:00'],
    // time
    ['13:00', '2024-06-15T13:00:00'],
    ['9:30:45', '2024-06-15T09:30:45'],
    ['9:30:45.123', '2024-06-15T09:30:45.123'],
    ['10 30', '2024-06-15T10:30:00'],
    ['9am', '2024-06-15T09:00:00'],
    ['5:30pm', '2024-06-15T17:30:00'],
    ['12am', '2024-06-15T00:00:00'],
    ['12pm', '2024-06-15T12:00:00'],
    ['9.30pm', '2024-06-15T21:30:00'],
    ['9 p.m.', '2024-06-15T21:00:00'],
    // date + time
    ['tom 13:00', '2024-06-16T13:00:00'],
    ['tomorrow at 5pm', '2024-06-16T17:00:00'],
    ['mon 9am', '2024-06-17T09:00:00'],
    ['next fri 17:00', '2024-06-21T17:00:00'],
    ['last mon 9am', '2024-06-10T09:00:00'],
    ['+3d 8:00', '2024-06-18T08:00:00'],
    ['eom 23:59', '2024-06-30T23:59:00'],
    ['15 jan 2025 14:30', '2025-01-15T14:30:00'],
    ['15 06 27 10 30', '2027-06-15T10:30:00'],
    ['8 30 15 06 27', '2015-08-30T06:27:00'],
    // a date or a time, shifted
    ['eom -4h', '2024-06-29T20:00:00'],
    ['end-of-month -4h', '2024-06-29T20:00:00'],
    ['tom 13:00 +30min', '2024-06-16T13:30:00'],
    ['mon +1w', '2024-06-24T00:00:00'],
    ['15 jan 2025 -1d', '2025-01-14T00:00:00'],
  ])('parses "%s" → %s', (input, expected) => {
    const result = parseFuzzyDate(input, askedAt(saturdayMidnight));

    expect(result.success && result.value.toPlainDateTime().toString()).toBe(expected);
  });
});

describe('parseFuzzyDate — how the parts of an input combine', () => {
  const saturdayAfternoon = Temporal.ZonedDateTime.from('2024-06-15T14:00:00[UTC]');

  function parsed(input: string, now = saturdayAfternoon): string | false {
    const result = parseFuzzyDate(input, askedAt(now));
    return result.success && result.value.toPlainDateTime().toString();
  }

  it('reads "now" as the moment it is asked at', () => {
    expect(parsed('now')).toBe('2024-06-15T14:00:00');
  });

  it.each([
    ['yesterday noon', '2024-06-14T12:00:00'],
    ['noon yesterday', '2024-06-14T12:00:00'],
    ['13:00 tom', '2024-06-16T13:00:00'],
    ['9am mon', '2024-06-17T09:00:00'],
    ['8:30 15.12', '2024-12-15T08:30:00'],
    ['17:05 15/06/99', '1999-06-15T17:05:00'],
    ['8 30 25.06.99', '1999-06-25T08:30:00'],
    ['17 05 jan 25, 2025', '2025-01-25T17:05:00'],
  ])('reads the same whichever of the date and the time comes first: "%s"', (input, expected) => {
    expect(parsed(input)).toBe(expected);
  });

  it.each([
    ['15 jan 2025 noon', '2025-01-15T12:00:00'],
    ['15.03.2024 midnight', '2024-03-15T00:00:00'],
    ['yesterday 9:00', '2024-06-14T09:00:00'],
    ['today 9:00', '2024-06-15T09:00:00'],
  ])('leaves a date that is told in full where it is, past or not: "%s"', (input, expected) => {
    expect(parsed(input)).toBe(expected);
  });

  it.each([
    ['9 pm', '2024-06-15T21:00:00'],
    ['9:30 pm', '2024-06-15T21:30:00'],
    ['9 30 pm', '2024-06-15T21:30:00'],
    ['12 30 am', '2024-06-16T00:30:00'],
    ['jan 1 12 30 pm', '2025-01-01T12:30:00'],
    ['tom 12 am', '2024-06-16T00:00:00'],
    ['jan 1 pm', '2025-01-01T13:00:00'],
  ])('applies am and pm written apart from the hour: "%s"', (input, expected) => {
    expect(parsed(input)).toBe(expected);
  });

  it.each([
    ['tom 13:00 45', '2024-06-16T13:00:45'],
    ['tom 13:00 45 900', '2024-06-16T13:00:45.9'],
    ['jan 25 27 17 05', '2027-01-25T17:05:00'],
  ])(
    'reads the numbers after the date as the time, largest part first: "%s"',
    (input, expected) => {
      expect(parsed(input)).toBe(expected);
    }
  );

  it.each([
    ['15-jan-2025', '2025-01-15T00:00:00'],
    ['15/jan/2025', '2025-01-15T00:00:00'],
    ['15 - 03 - 2025', '2025-03-15T00:00:00'],
    ['end-of-month', '2024-06-30T00:00:00'],
    ['3 days', '2024-06-18T00:00:00'],
    ['15/06/17', '2017-06-15T00:00:00'],
    ['tom 10:30.', '2024-06-16T10:30:00'],
    ["q1'25", '2025-01-01T00:00:00'],
    ['Q32026', '2026-07-01T00:00:00'],
    ['TOMORROW 9AM', '2024-06-16T09:00:00'],
  ])('reads "%s"', (input, expected) => {
    expect(parsed(input)).toBe(expected);
  });

  describe('words that only join the others', () => {
    it.each([
      ['tomorrow at 5pm', '2024-06-16T17:00:00'],
      ['tom at 17:00', '2024-06-16T17:00:00'],
      ['on monday', '2024-06-17T00:00:00'],
      ['monday at 9', '2024-06-17T09:00:00'],
      ['at noon', '2024-06-16T12:00:00'],
      ['15 jan at 14:30', '2025-01-15T14:30:00'],
      ['on 15 jan', '2025-01-15T00:00:00'],
      ['on the 15th', '2024-07-15T00:00:00'],
      ['1st of january', '2025-01-01T00:00:00'],
      ['15th of jan 2025', '2025-01-15T00:00:00'],
      ['the 15th of january', '2025-01-15T00:00:00'],
    ])('reads "%s" as if they were not written', (input, expected) => {
      expect(parsed(input)).toBe(expected);
    });

    it.each(['at', 'on the', 'of'])('reads nothing in "%s" alone', input => {
      expect(parsed(input)).toBe(false);
    });
  });

  describe('a weekday beside a date', () => {
    it.each([
      ['wed 15 jan 2025', '2025-01-15T00:00:00'],
      ['wednesday, 15 jan 2025', '2025-01-15T00:00:00'],
      ['Wed Jan 15 2025', '2025-01-15T00:00:00'],
      ['15.01.2025 wed', '2025-01-15T00:00:00'],
      ['Wed, 15 Jan 2025 14:30:00 +0200', '2025-01-15T12:30:00'],
      ['Wed Jan 15 14:30:00 UTC 2025', '2025-01-15T14:30:00'],
    ])('confirms the date of "%s"', (input, expected) => {
      expect(parsed(input)).toBe(expected);
    });

    it.each(['thu 15 jan 2025', 'mon 15.01.2025', 'wed thu 15 jan 2025'])(
      'does not read "%s", whose weekday is another',
      input => {
        expect(parsed(input)).toBe(false);
      }
    );

    it.each([
      ['fri 21 jun', '2024-06-21T00:00:00'],
      ['sat 21 jun', '2025-06-21T00:00:00'],
      ['fri 13th', '2024-09-13T00:00:00'],
      ['mon 15/06', '2026-06-15T00:00:00'],
      ['sun 29 feb', '2032-02-29T00:00:00'],
    ])('takes the next occurrence of "%s" that falls on the weekday', (input, expected) => {
      expect(parsed(input)).toBe(expected);
    });

    it('still takes a number beside a lone weekday for the hour', () => {
      expect(parsed('mon 14 30')).toBe('2024-06-17T14:30:00');
    });
  });

  describe('words that count from today', () => {
    it.each([
      ['next week', '2024-06-22T00:00:00'],
      ['next month', '2024-07-15T00:00:00'],
      ['next year', '2025-06-15T00:00:00'],
      ['last week', '2024-06-08T00:00:00'],
      ['last year', '2023-06-15T00:00:00'],
      ['this month', '2024-06-15T00:00:00'],
      ['next week 9:00', '2024-06-22T09:00:00'],
      ['day after tomorrow', '2024-06-17T00:00:00'],
      ['day before yesterday', '2024-06-13T00:00:00'],
      ['day after tomorrow 9am', '2024-06-17T09:00:00'],
      ['a week ago', '2024-06-08T00:00:00'],
      ['in a week', '2024-06-22T00:00:00'],
      ['in an hour', '2024-06-15T15:00:00'],
      ['an hour ago', '2024-06-15T13:00:00'],
    ])('reads "%s"', (input, expected) => {
      expect(parsed(input)).toBe(expected);
    });

    it.each([
      ['this friday', '2024-06-21T00:00:00'],
      ['this sat', '2024-06-15T00:00:00'],
      ['next sat', '2024-06-22T00:00:00'],
    ])('takes today for "this" weekday when today is one: "%s"', (input, expected) => {
      expect(parsed(input)).toBe(expected);
    });
  });

  describe('other ways to spell the same', () => {
    it.each([
      ['sept 15', '2024-09-15T00:00:00'],
      ['15 Sept 2025', '2025-09-15T00:00:00'],
      ['9 p.m.', '2024-06-15T21:00:00'],
      ['9:30 p.m.', '2024-06-15T21:30:00'],
      ['9 a.m.', '2024-06-16T09:00:00'],
      ['9.30pm', '2024-06-15T21:30:00'],
      ['tom 9.30am', '2024-06-16T09:30:00'],
      ['2 hrs', '2024-06-15T16:00:00'],
      ['30s', '2024-06-15T14:00:30'],
      ['+30sec', '2024-06-15T14:00:30'],
      ['in 30 seconds', '2024-06-15T14:00:30'],
      ['90 secs ago', '2024-06-15T13:58:30'],
      ['1h30min', '2024-06-15T15:30:00'],
      ['-1h30min', '2024-06-15T12:30:00'],
      ['eom -1d12h', '2024-06-28T12:00:00'],
      ['tom 13:00 +1h30min', '2024-06-16T14:30:00'],
    ])('reads "%s"', (input, expected) => {
      expect(parsed(input)).toBe(expected);
    });

    it.each([
      ['15\u00a0jan', '2025-01-15T00:00:00'],
      ['tom\u00a013:00', '2024-06-16T13:00:00'],
      ['\uff11\uff15 jan \uff12\uff10\uff12\uff15', '2025-01-15T00:00:00'],
      ['15\u201303\u20132025', '2025-03-15T00:00:00'],
      ['15 jan \u2013 1d', '2025-01-14T00:00:00'],
      ['eom \u22124h', '2024-06-29T20:00:00'],
    ])('reads "%s" copied from a formatted text', (input, expected) => {
      expect(parsed(input)).toBe(expected);
    });

    it.each(['1/2d', '9:30h', 'eom/4h'])(
      'does not read "%s", an offset joined by what is no sign',
      input => {
        expect(parsed(input)).toBe(false);
      }
    );
  });

  describe('an offset with a fraction', () => {
    it.each([
      ['1.5h', '2024-06-15T15:30:00'],
      ['+1.5h', '2024-06-15T15:30:00'],
      ['-1.5h', '2024-06-15T12:30:00'],
      ['0.5h', '2024-06-15T14:30:00'],
      ['-0.5h', '2024-06-15T13:30:00'],
      ['1.25h', '2024-06-15T15:15:00'],
      ['1,5h', '2024-06-15T15:30:00'],
      ['2.5min', '2024-06-15T14:02:30'],
      ['1.5s', '2024-06-15T14:00:01.5'],
      ['2.5d', '2024-06-17T12:00:00'],
      ['0.5w', '2024-06-18T12:00:00'],
      ['in 1.5 hours', '2024-06-15T15:30:00'],
      ['1.5 hours ago', '2024-06-15T12:30:00'],
      ['eom -1.5h', '2024-06-29T22:30:00'],
      ['eom-1.5h', '2024-06-29T22:30:00'],
      ['tom 13:00 +0.5h', '2024-06-16T13:30:00'],
      ['1.5h30min', '2024-06-15T16:00:00'],
    ])('reads "%s"', (input, expected) => {
      expect(parsed(input)).toBe(expected);
    });

    it.each(['1.5m', '1.5y', '2.5 months', 'in 1.5 years'])(
      'does not read "%s": a part of a month or a year has no length of its own',
      input => {
        expect(parsed(input)).toBe(false);
      }
    );

    it.each([
      ['15.03.2025', '2025-03-15T00:00:00'],
      ['15.03', '2025-03-15T00:00:00'],
      ['jan 15, 2025', '2025-01-15T00:00:00'],
      ['10, nov, 2025', '2025-11-10T00:00:00'],
      ['tom, 13:00', '2024-06-16T13:00:00'],
    ])('still reads the dot and the comma of "%s" as separators', (input, expected) => {
      expect(parsed(input)).toBe(expected);
    });
  });

  describe('the parts of a day', () => {
    it.each([
      ['tonight', '2024-06-15T20:00:00'],
      ['tomorrow morning', '2024-06-16T09:00:00'],
      ['tom afternoon', '2024-06-16T15:00:00'],
      ['mon evening', '2024-06-17T19:00:00'],
      ['15 jan 2025 morning', '2025-01-15T09:00:00'],
      ['evening', '2024-06-15T19:00:00'],
      ['morning', '2024-06-16T09:00:00'],
    ])('reads "%s" as the usual hour of that part', (input, expected) => {
      expect(parsed(input)).toBe(expected);
    });

    it.each([
      ['tonight at 9', '2024-06-15T21:00:00'],
      ['tonight 9:30', '2024-06-15T21:30:00'],
      ['tonight 11 45', '2024-06-15T23:45:00'],
      ['tomorrow evening 8', '2024-06-16T20:00:00'],
      ['tomorrow morning 8', '2024-06-16T08:00:00'],
      ['tom afternoon 12:30', '2024-06-16T12:30:00'],
    ])('takes an hour of the dial in "%s" for that half of the day', (input, expected) => {
      expect(parsed(input)).toBe(expected);
    });

    it.each([
      ['tonight 21:00', '2024-06-15T21:00:00'],
      ['tonight 9pm', '2024-06-15T21:00:00'],
      ['tomorrow morning 9am', '2024-06-16T09:00:00'],
      ['tonight 0:30', '2024-06-15T00:30:00'],
    ])('leaves an hour that says its half of the day as it is: "%s"', (input, expected) => {
      expect(parsed(input)).toBe(expected);
    });

    it.each(['tonight tomorrow', 'morning evening', 'tonight noon'])(
      'does not choose between the two readings of "%s"',
      input => {
        expect(parsed(input)).toBe(false);
      }
    );
  });

  describe('the weekend', () => {
    it.each([
      ['2024-06-12T14:00:00[UTC]', 'weekend', '2024-06-15T00:00:00'],
      ['2024-06-12T14:00:00[UTC]', 'this weekend', '2024-06-15T00:00:00'],
      ['2024-06-12T14:00:00[UTC]', 'next weekend', '2024-06-22T00:00:00'],
      ['2024-06-12T14:00:00[UTC]', 'last weekend', '2024-06-08T00:00:00'],
      ['2024-06-15T14:00:00[UTC]', 'weekend', '2024-06-15T00:00:00'],
      ['2024-06-15T14:00:00[UTC]', 'next weekend', '2024-06-22T00:00:00'],
      ['2024-06-16T14:00:00[UTC]', 'weekend', '2024-06-16T00:00:00'],
      ['2024-06-16T14:00:00[UTC]', 'next weekend', '2024-06-22T00:00:00'],
      ['2024-06-16T14:00:00[UTC]', 'last weekend', '2024-06-08T00:00:00'],
    ])('asked at %s, reads "%s"', (asked, input, expected) => {
      expect(parsed(input, Temporal.ZonedDateTime.from(asked))).toBe(expected);
    });

    it.each([
      ['next weekend 10:00', '2024-06-22T10:00:00'],
      ['next weekend morning', '2024-06-22T09:00:00'],
      ['next weekend +1d', '2024-06-23T00:00:00'],
    ])('reads "%s" with what stands beside it', (input, expected) => {
      expect(parsed(input)).toBe(expected);
    });
  });

  describe('the edges of a period', () => {
    it.each([
      ['eod', '2024-06-15T23:59:59.999'],
      ['end of day', '2024-06-15T23:59:59.999'],
      ['eow', '2024-06-16T00:00:00'],
      ['end of week', '2024-06-16T00:00:00'],
      ['bow', '2024-06-17T00:00:00'],
      ['sow', '2024-06-17T00:00:00'],
      ['start of week', '2024-06-17T00:00:00'],
      ['boq', '2024-07-01T00:00:00'],
      ['soq', '2024-07-01T00:00:00'],
      ['start of quarter', '2024-07-01T00:00:00'],
      ['beginning of quarter', '2024-07-01T00:00:00'],
      ['end of quarter', '2024-06-30T00:00:00'],
    ])('reads "%s"', (input, expected) => {
      expect(parsed(input)).toBe(expected);
    });

    it.each([
      ['end of next month', '2024-07-31T00:00:00'],
      ['end-of-next-month', '2024-07-31T00:00:00'],
      ['start of next month', '2024-07-01T00:00:00'],
      ['end of last month', '2024-05-31T00:00:00'],
      ['start of last month', '2024-05-01T00:00:00'],
      ['end of this month', '2024-06-30T00:00:00'],
      ['end of next year', '2025-12-31T00:00:00'],
      ['start of next quarter', '2024-07-01T00:00:00'],
      ['end of next quarter', '2024-09-30T00:00:00'],
      ['end of next week', '2024-06-23T00:00:00'],
      ['start of last week', '2024-06-03T00:00:00'],
      ['end of next month 18:00', '2024-07-31T18:00:00'],
      ['end of next month -4h', '2024-07-30T20:00:00'],
    ])('reads "%s", the edge of a period next to this one', (input, expected) => {
      expect(parsed(input)).toBe(expected);
    });

    it('takes today for a start that falls on today', () => {
      const monday = Temporal.ZonedDateTime.from('2024-07-01T09:00:00[UTC]');

      expect(parsed('bow', monday)).toBe('2024-07-01T00:00:00');
      expect(parsed('boq', monday)).toBe('2024-07-01T00:00:00');
      expect(parsed('eow', monday)).toBe('2024-07-07T00:00:00');
    });
  });

  describe('numbers with nothing but spaces between them', () => {
    it.each([
      ['10 30', '2024-06-16T10:30:00'],
      ['15 30', '2024-06-15T15:30:00'],
      ['17 45 30', '2024-06-15T17:45:30'],
      ['0 05', '2024-06-16T00:05:00'],
      ['12 25', '2024-06-16T12:25:00'],
    ])('reads "%s" as a time when it can be one', (input, expected) => {
      expect(parsed(input)).toBe(expected);
    });

    it.each([
      ['25 12', '2024-12-25T00:00:00'],
      ['30 8', '2024-08-30T00:00:00'],
      ['8 30 27', '2027-08-30T00:00:00'],
      ['31 12 99', '1999-12-31T00:00:00'],
      ['99 12 31', '1999-12-31T00:00:00'],
      ['82 06 15 10 30', '1982-06-15T10:30:00'],
      ['12 99', '1999-12-01T00:00:00'],
      ['99 12', '1999-12-01T00:00:00'],
      ['15 06 10', '2010-06-15T00:00:00'],
      ['01 2027', '2027-01-01T00:00:00'],
      ['2027 01', '2027-01-01T00:00:00'],
      ['2025 01 15', '2025-01-15T00:00:00'],
    ])('reads "%s" as the date its values allow', (input, expected) => {
      expect(parsed(input)).toBe(expected);
    });

    it.each([
      ['8 30 15 06 27', '2015-08-30T06:27:00'],
      ['15 06 27 10 30', '2027-06-15T10:30:00'],
      ['30 8 15 06 27', '2015-08-30T06:27:00'],
      ['15 06 2027 10', '2027-06-15T10:00:00'],
      ['15 06 27 10 30 45', '2027-06-15T10:30:45'],
      ['15 06 27 10 30 45 900', '2027-06-15T10:30:45.9'],
      ['2025 01 15 9 30', '2025-01-15T09:30:00'],
      ['25 12 17 30', '2024-12-25T17:30:00'],
      ['25 12 17 30 45', '2024-12-25T17:30:45'],
      ['01 2027 10 30', '2027-01-01T10:30:00'],
    ])('reads "%s" as a date followed by a time', (input, expected) => {
      expect(parsed(input)).toBe(expected);
    });

    it.each([
      ['1 01 17 00', '2025-01-01T17:00:00'],
      ['10 11 12 13', '2024-11-10T12:13:00'],
      ['5 03 27 8', '2027-03-05T08:00:00'],
      ['2025 3 5 8', '2025-03-05T08:00:00'],
      ['15 06 17', '2017-06-15T00:00:00'],
    ])('takes the reading the numbers of "%s" weigh most in', (input, expected) => {
      expect(parsed(input)).toBe(expected);
    });

    it.each([
      ['5 03 8:05 45', '2025-03-05T08:05:45'],
      ['8:05 45 5 03', '2025-03-05T08:05:45'],
      ['8:05 45 10', '2024-07-10T08:05:45'],
      ['15 jan 14:30 2025', '2025-01-15T14:30:00'],
    ])('keeps the date and the time of "%s" whole when it can', (input, expected) => {
      expect(parsed(input)).toBe(expected);
    });

    it.each([
      ['30 45', false],
      ['45 10', false],
      ['45', false],
      ['2025 13 01', false],
      ['32 13 2025', false],
      ['1 2 3 4 5 6 7 8', false],
    ])('does not read "%s", which fits no order', (input, expected) => {
      expect(parsed(input)).toBe(expected);
    });
  });

  describe('an offset beside a date or a time', () => {
    it.each([
      ['end-of-month -4h', '2024-06-29T20:00:00'],
      ['end of month -4h', '2024-06-29T20:00:00'],
      ['eom -4h', '2024-06-29T20:00:00'],
      ['eom 18:00 -4h', '2024-06-30T14:00:00'],
      ['eom -1d', '2024-06-29T00:00:00'],
      ['eoy +1d', '2025-01-01T00:00:00'],
      ['bom -1d', '2024-06-30T00:00:00'],
      ['eoq +2w', '2024-07-14T00:00:00'],
      ['tom -4h', '2024-06-15T20:00:00'],
      ['tom +3d', '2024-06-19T00:00:00'],
      ['tom 13:00 +30min', '2024-06-16T13:30:00'],
      ['yesterday 9am -90min', '2024-06-14T07:30:00'],
      ['mon +1w', '2024-06-24T00:00:00'],
      ['next fri 17:00 -2h', '2024-06-21T15:00:00'],
      ['15 jan 2025 -1d', '2025-01-14T00:00:00'],
      ['15.03.2025 +2w', '2025-03-29T00:00:00'],
      ['2025-01-31 +1m', '2025-02-28T00:00:00'],
      ['Q1 2025 -1d', '2024-12-31T00:00:00'],
      ['jan 2027 +1y', '2028-01-01T00:00:00'],
      ['15 jan 2025 14:30 in 2 hours', '2025-01-15T16:30:00'],
      ['eom 3 days ago', '2024-06-27T00:00:00'],
    ])('shifts what the rest of "%s" says', (input, expected) => {
      expect(parsed(input)).toBe(expected);
    });

    it.each([
      ['-4h eom', '2024-06-29T20:00:00'],
      ['+30min tom 13:00', '2024-06-16T13:30:00'],
      ['+1d 15.03.2025', '2025-03-16T00:00:00'],
    ])('shifts the same when it is written first: "%s"', (input, expected) => {
      expect(parsed(input)).toBe(expected);
    });

    it.each([
      ['eom-4h', '2024-06-29T20:00:00'],
      ['tom-1d', '2024-06-15T00:00:00'],
      ['eom+2d', '2024-07-02T00:00:00'],
      ['mon14-30min', '2024-06-17T13:30:00'],
    ])('takes a dash that joins it to the word before for its minus: "%s"', (input, expected) => {
      expect(parsed(input)).toBe(expected);
    });

    it.each([
      ['eom -1d -4h', '2024-06-28T20:00:00'],
      ['tom +1w +2d 9:00', '2024-06-25T09:00:00'],
    ])('applies several offsets one after another: "%s"', (input, expected) => {
      expect(parsed(input)).toBe(expected);
    });

    it.each([
      ['+3d', '2024-06-18T00:00:00'],
      ['2 weeks ago', '2024-06-01T00:00:00'],
      ['+3d 8:00', '2024-06-18T08:00:00'],
      ['+1d 15', '2024-06-16T15:00:00'],
    ])('shifts today when nothing else tells the date: "%s"', (input, expected) => {
      expect(parsed(input)).toBe(expected);
    });

    it.each([
      ['+4h', '2024-06-15T18:00:00'],
      ['-30min', '2024-06-15T13:30:00'],
      ['in 2 hours', '2024-06-15T16:00:00'],
      ['90 minutes ago', '2024-06-15T12:30:00'],
      ['45 mins', '2024-06-15T14:45:00'],
      ['now +2h', '2024-06-15T16:00:00'],
      ['+1d +4h', '2024-06-16T18:00:00'],
    ])('shifts this very moment when it counts hours or minutes alone: "%s"', (input, expected) => {
      expect(parsed(input)).toBe(expected);
    });

    it('chooses the occurrence after the shift, not before it', () => {
      expect(parsed('noon +4h')).toBe('2024-06-15T16:00:00');
      expect(parsed('noon +1h')).toBe('2024-06-16T13:00:00');
    });

    it.each(['eom -99999999999h', 'tom +99999999999min', '15 jan 9999 +1y'])(
      'fails on "%s", which reaches past the calendar, and does not throw',
      input => {
        expect(parsed(input)).toBe(false);
      }
    );
  });

  describe('the moment and the zone, told apart', () => {
    const moment = Temporal.Instant.from('2024-06-15T12:30:00Z');

    it.each(['Europe/Berln', '', '+25:00'])(
      'refuses to read anything in the time zone "%s", which does not exist',
      timeZone => {
        expect(() => parseFuzzyDate('today', { now: moment, timeZone })).toThrow(
          `parseFuzzyDate: unknown time zone "${timeZone}"`
        );
      }
    );

    it.each([
      ['UTC', '2024-06-15T13:00:00+00:00[UTC]'],
      ['Europe/Berlin', '2024-06-16T13:00:00+02:00[Europe/Berlin]'],
      ['Pacific/Auckland', '2024-06-16T13:00:00+12:00[Pacific/Auckland]'],
      ['America/Los_Angeles', '2024-06-15T13:00:00-07:00[America/Los_Angeles]'],
    ])('reads "13:00" asked at one moment in %s', (timeZone, expected) => {
      const result = parseFuzzyDate('13:00', { now: moment, timeZone });

      expect(result.success && result.value.toString()).toBe(expected);
    });

    it('takes the first occurrence not yet past unless the nearest is asked for', () => {
      const options = { now: moment, timeZone: 'Europe/Berlin' };
      const ahead = parseFuzzyDate('9:00', options);
      const nearest = parseFuzzyDate('9:00', { ...options, nearest: true });

      expect(ahead.success && ahead.value.toPlainDateTime().toString()).toBe('2024-06-16T09:00:00');
      expect(nearest.success && nearest.value.toPlainDateTime().toString()).toBe(
        '2024-06-15T09:00:00'
      );
    });
  });

  describe('the time zone of the asker', () => {
    const sameInstant = Temporal.Instant.from('2024-06-15T12:30:00Z');
    const inAuckland = sameInstant.toZonedDateTimeISO('Pacific/Auckland');
    const inLosAngeles = sameInstant.toZonedDateTimeISO('America/Los_Angeles');

    function read(input: string, now: Temporal.ZonedDateTime): string | false {
      const result = parseFuzzyDate(input, askedAt(now));
      return result.success && result.value.toString();
    }

    it.each([
      ['today', '2024-06-16T00:00:00+12:00[Pacific/Auckland]'],
      ['tom 9:00', '2024-06-17T09:00:00+12:00[Pacific/Auckland]'],
      ['13:00', '2024-06-16T13:00:00+12:00[Pacific/Auckland]'],
      ['eom', '2024-06-30T00:00:00+12:00[Pacific/Auckland]'],
      ['+1h', '2024-06-16T01:30:00+12:00[Pacific/Auckland]'],
    ])('reads "%s" on the calendar and the clock of Auckland', (input, expected) => {
      expect(read(input, inAuckland)).toBe(expected);
    });

    it.each([
      ['today', '2024-06-15T00:00:00-07:00[America/Los_Angeles]'],
      ['tom 9:00', '2024-06-16T09:00:00-07:00[America/Los_Angeles]'],
      ['13:00', '2024-06-15T13:00:00-07:00[America/Los_Angeles]'],
      ['+1h', '2024-06-15T06:30:00-07:00[America/Los_Angeles]'],
    ])('reads "%s" at the same instant on those of Los Angeles', (input, expected) => {
      expect(read(input, inLosAngeles)).toBe(expected);
    });

    it('answers in the zone of the asker when the input names another', () => {
      expect(read('15 jan 2025 14:30Z', inAuckland)).toBe(
        '2025-01-16T03:30:00+13:00[Pacific/Auckland]'
      );
    });

    it('moves a time the clocks skip to the first one that exists', () => {
      const beforeSpringForward = Temporal.ZonedDateTime.from('2024-03-30T12:00:00[Europe/Berlin]');

      expect(read('tom 2:30', beforeSpringForward)).toBe(
        '2024-03-31T03:30:00+02:00[Europe/Berlin]'
      );
    });

    it('takes the first of the two times the clocks repeat', () => {
      const beforeFallBack = Temporal.ZonedDateTime.from('2024-10-26T12:00:00[Europe/Berlin]');

      expect(read('tom 2:30', beforeFallBack)).toBe('2024-10-27T02:30:00+02:00[Europe/Berlin]');
    });
  });

  describe('a time told in another time zone', () => {
    const berlinAfternoon = Temporal.ZonedDateTime.from('2024-06-15T14:00:00[Europe/Berlin]');

    it.each([
      ['2024-01-15T14:30:00Z', '2024-01-15T15:30:00'],
      ['2024-01-15T14:30Z', '2024-01-15T15:30:00'],
      ['2024-01-15T14:30:00.123456789Z', '2024-01-15T15:30:00.123'],
      ['2024-01-15T14:30:00+02:00', '2024-01-15T13:30:00'],
      ['2024-01-15T23:30:00-05:00', '2024-01-16T05:30:00'],
      ['15 jan 2025 10:30+02:00', '2025-01-15T09:30:00'],
      ['15 jan 2025 10:30 +0200', '2025-01-15T09:30:00'],
      ['15 jan 2025 10:30 utc', '2025-01-15T11:30:00'],
    ])('reads "%s" as that moment on the clock of the asker', (input, expected) => {
      expect(parsed(input, berlinAfternoon)).toBe(expected);
    });

    it('gives back the moment a date editor wrote as an instant', () => {
      const picked = Temporal.ZonedDateTime.from('2025-03-09T18:45:30.5[Europe/Berlin]');

      expect(parsed(picked.toInstant().toString(), berlinAfternoon)).toBe(
        picked.toPlainDateTime().toString()
      );
    });

    it.each(['10:30+25:00', '10:30+02:60', '10:30Z+02:00', '10:30+02:00 11:30Z'])(
      'does not read "%s"',
      input => {
        expect(parsed(input, berlinAfternoon)).toBe(false);
      }
    );
  });

  describe('what is left untold recurs', () => {
    it('takes the next month that has the day', () => {
      const lastOfJanuary = Temporal.ZonedDateTime.from('2025-01-31T09:00:00[UTC]');

      expect(parsed('31st', lastOfJanuary)).toBe('2025-03-31T00:00:00');
    });

    it('takes the next year that has the leap day', () => {
      expect(parsed('feb 29')).toBe('2028-02-29T00:00:00');
    });

    it('takes today for a day and month that fall on today, while the day has not begun', () => {
      const saturdayMidnight = Temporal.ZonedDateTime.from('2024-06-15T00:00:00[UTC]');

      expect(parsed('15.06', saturdayMidnight)).toBe('2024-06-15T00:00:00');
      expect(parsed('15 jun', saturdayMidnight)).toBe('2024-06-15T00:00:00');
    });

    it('takes next year for a month whose first day has begun', () => {
      const firstOfJune = Temporal.ZonedDateTime.from('2024-06-01T09:00:00[UTC]');

      expect(parsed('june', firstOfJune)).toBe('2025-06-01T00:00:00');
      expect(parsed('june', firstOfJune.startOfDay())).toBe('2024-06-01T00:00:00');
    });

    it('takes next year for a day and month whose time has passed today', () => {
      expect(parsed('15.06 9:00')).toBe('2025-06-15T09:00:00');
      expect(parsed('15 jun 15:00')).toBe('2024-06-15T15:00:00');
    });
  });

  describe('contradictions', () => {
    it.each([
      'tom yesterday',
      'mon tue',
      'eom bom',
      'jan feb',
      '15th jan 16th',
      'noon 13:00',
      '13:00 14:00',
      "15 jan 2025 '26",
      '9 am pm',
      'today jan',
    ])('does not choose between the two readings of "%s"', input => {
      expect(parsed(input)).toBe(false);
    });
  });

  describe('input that does not read in full', () => {
    it.each([
      'mon 45',
      'tom25',
      'tom 13:00 900',
      'next',
      'days',
      'the',
      'in 3',
      'pm',
      '2025',
      '13:00 2025',
      'jan gibberish',
    ])('does not drop the part of "%s" it cannot place', input => {
      expect(parsed(input)).toBe(false);
    });

    it.each([
      '+99999999999y',
      '-99999999999d',
      '99999999999m',
      'in 99999999999999999999 days',
      '9999999 weeks ago',
      '999999999999999999999',
      '15 jan 99999',
    ])('fails on "%s", which reaches past the calendar, and does not throw', input => {
      expect(parsed(input)).toBe(false);
    });

    it.each(['2025-13-01', '2025-31-12', '31/31/2025', '13/2025'])(
      'does not reorder the parts of "%s" to make a date of them',
      input => {
        expect(parsed(input)).toBe(false);
      }
    );

    it.each(['25:00', '12:60', '13pm', '0am', '31.06.2025', '29 feb 2025', '15/13/2025'])(
      'does not read "%s", which no clock or calendar has',
      input => {
        expect(parsed(input)).toBe(false);
      }
    );
  });
});
