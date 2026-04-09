import { Temporal } from '@js-temporal/polyfill';
import { describe, expect, it } from 'vitest';
import { parseFuzzyDate } from './parseFuzzyDate';
import { parseTokenBased } from './pipeline';
import { applyContextRules, detectConflicts, resolveSlots, tagCandidates } from './scoring';
import { tokenize } from './tokenizer';
import type { DateTimeParseResult, ISlotContext } from './types';
import { ETokenKind } from './types';

describe('parseFuzzyDate', () => {
  const now = Temporal.PlainDate.from('2024-06-15').toZonedDateTime('UTC'); // Saturday at midnight

  function parse(input: string): DateTimeParseResult {
    return parseFuzzyDate(input, { now });
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
      return parseFuzzyDate(input, { now: nowAt14 });
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
        return parseFuzzyDate(input, { now: nowTue14 });
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
      return parseFuzzyDate(input, { now: nowAt14, nearest: true });
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

function makeContext(overrides: Partial<ISlotContext> = {}): ISlotContext {
  return {
    hasDateKeyword: false,
    hasBoundaryKeyword: false,
    hasMonthName: false,
    hasTimeKeyword: false,
    hasColonTime: false,
    hasOrdinal: false,
    hasAmPm: false,
    hasOffset: false,
    hasWeekday: false,
    hasQuarter: false,
    colonCount: 0,
    datePartCount: 0,
    hasDotAfterColon: false,
    ...overrides,
  };
}

describe('tokenize', () => {
  it('classifies month names', () => {
    const tokens = tokenize('jan');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe(ETokenKind.MonthName);
    expect(tokens[0].value).toBe(1);
  });

  it('classifies bare numbers', () => {
    const tokens = tokenize('10 20');
    expect(tokens).toHaveLength(2);
    expect(tokens[0].kind).toBe(ETokenKind.Number);
    expect(tokens[0].value).toBe(10);
    expect(tokens[1].value).toBe(20);
  });

  it('classifies colon time', () => {
    const tokens = tokenize('13:00');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe(ETokenKind.ColonTime);
    expect(tokens[0].extra).toBe('13:0:0.0');
  });

  it('classifies colon time with seconds and ms', () => {
    const tokens = tokenize('9:30:45.123');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].extra).toBe('9:30:45.123');
  });

  it('splits "9am" into colon time token', () => {
    const tokens = tokenize('9am');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe(ETokenKind.ColonTime);
    expect(tokens[0].extra).toBe('9:0:0.0');
  });

  it('splits "5:30pm" into colon time token', () => {
    const tokens = tokenize('5:30pm');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].extra).toBe('17:30:0.0');
  });

  it('classifies ordinals', () => {
    const tokens = tokenize('15th');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe(ETokenKind.Ordinal);
    expect(tokens[0].value).toBe(15);
  });

  it('classifies date keywords', () => {
    const tokens = tokenize('tomorrow');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe(ETokenKind.Keyword);
  });

  it('classifies time keywords', () => {
    const tokens = tokenize('noon');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe(ETokenKind.TimeKeyword);
  });

  it('classifies boundary keywords', () => {
    const tokens = tokenize('eom');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe(ETokenKind.BoundaryKeyword);
  });

  it('classifies apostrophe year', () => {
    const tokens = tokenize("'27");
    expect(tokens).toHaveLength(1);
    expect(tokens[0].value).toBe(2027);
  });

  it('classifies offset tokens', () => {
    const tokens = tokenize('+3d');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe(ETokenKind.Offset);
    expect(tokens[0].value).toBe(3);
    expect(tokens[0].extra).toBe('d');
  });

  it('classifies duration tokens', () => {
    const tokens = tokenize('1w');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe(ETokenKind.Duration);
    expect(tokens[0].value).toBe(1);
    expect(tokens[0].extra).toBe('w');
  });

  it('classifies unknown tokens', () => {
    const tokens = tokenize('gibberish');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe(ETokenKind.Unknown);
  });

  it('handles comma-separated input', () => {
    const tokens = tokenize('10, nov, 2025');
    expect(tokens).toHaveLength(3);
    expect(tokens[0].value).toBe(10);
    expect(tokens[1].value).toBe(11);
    expect(tokens[2].value).toBe(2025);
  });

  it('classifies weekday names', () => {
    const tokens = tokenize('monday');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe(ETokenKind.WeekdayName);
    expect(tokens[0].value).toBe(1);
  });

  it('classifies quarter tokens', () => {
    const tokens = tokenize('Q1');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe(ETokenKind.Quarter);
    expect(tokens[0].value).toBe(1);
  });

  it('classifies AM/PM standalone', () => {
    const tokens = tokenize('pm');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe(ETokenKind.AmPm);
    expect(tokens[0].value).toBe(12);
  });

  it('classifies direction tokens', () => {
    const tokens = tokenize('next');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe(ETokenKind.Direction);
    expect(tokens[0].value).toBe(1);
  });

  it('classifies unit tokens', () => {
    const tokens = tokenize('days');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe(ETokenKind.Unit);
    expect(tokens[0].extra).toBe('d');
  });
});

describe('detectConflicts', () => {
  it('detects two date keywords', () => {
    const tokens = tokenize('tom yesterday');
    expect(detectConflicts(tokens)).toBeDefined();
  });

  it('detects date keyword + duration', () => {
    const tokens = tokenize('yesterday 1d');
    expect(detectConflicts(tokens)).toBeDefined();
  });

  it('detects date keyword + offset', () => {
    const tokens = tokenize('tom +3d');
    expect(detectConflicts(tokens)).toBeDefined();
  });

  it('detects two time sources', () => {
    const tokens = tokenize('noon 13:00');
    expect(detectConflicts(tokens)).toBeDefined();
  });

  it('detects multiple month names', () => {
    const tokens = tokenize('jan feb');
    expect(detectConflicts(tokens)).toBeDefined();
  });

  it('allows date keyword + time', () => {
    const tokens = tokenize('tomorrow 13:00');
    expect(detectConflicts(tokens)).toBeUndefined();
  });

  it('allows date keyword + number (hour)', () => {
    const tokens = tokenize('tom 10');
    expect(detectConflicts(tokens)).toBeUndefined();
  });

  it('allows month + day + time numbers', () => {
    const tokens = tokenize('10 nov 10 30');
    expect(detectConflicts(tokens)).toBeUndefined();
  });
});

describe('tagCandidates', () => {
  it('creates candidates for Number and Ordinal tokens only', () => {
    const tokens = tokenize('10 nov 2025');
    const context = makeContext({ hasMonthName: true });
    const candidates = tagCandidates(tokens, context);
    expect(candidates).toHaveLength(2);
    expect(candidates[0].token.value).toBe(10);
    expect(candidates[1].token.value).toBe(2025);
  });

  it('assigns year score 1.0 for 4-digit numbers', () => {
    const tokens = tokenize('2025');
    const context = makeContext();
    const candidates = tagCandidates(tokens, context);
    expect(candidates[0].scores.year).toBe(1.0);
  });

  it('assigns ms score 1.0 for 3-digit numbers (100-999)', () => {
    const tokens = tokenize('123');
    const context = makeContext();
    const candidates = tagCandidates(tokens, context);
    expect(candidates[0].scores.ms).toBe(1.0);
  });

  it('assigns year score 0.9 for 60-99 range', () => {
    const tokens = tokenize('82');
    const context = makeContext();
    const candidates = tagCandidates(tokens, context);
    expect(candidates[0].scores.year).toBe(0.9);
  });

  it('assigns day and hour scores for 13-23 range', () => {
    const tokens = tokenize('14');
    const context = makeContext();
    const candidates = tagCandidates(tokens, context);
    expect(candidates[0].scores.day).toBe(0.5);
    expect(candidates[0].scores.hour).toBe(0.7);
  });

  it('includes Ordinal tokens as candidates', () => {
    const tokens = tokenize('15th');
    const context = makeContext();
    const candidates = tagCandidates(tokens, context);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].token.kind).toBe(ETokenKind.Ordinal);
  });
});

describe('applyContextRules', () => {
  it('zeros month for all candidates when MonthName present', () => {
    const tokens = tokenize('10 nov 2025');
    const context = makeContext({ hasMonthName: true });
    const candidates = tagCandidates(tokens, context);
    applyContextRules(candidates, tokens, context);
    for (const c of candidates) {
      expect(c.scores.month).toBe(0);
    }
  });

  it('zeros day/month/year when date keyword present', () => {
    const tokens = tokenize('10 30');
    const context = makeContext({ hasDateKeyword: true });
    const candidates = tagCandidates(tokens, context);
    applyContextRules(candidates, tokens, context);
    for (const c of candidates) {
      expect(c.scores.day).toBe(0);
      expect(c.scores.month).toBe(0);
      expect(c.scores.year).toBe(0);
    }
  });

  it('zeros hour/minute/second/ms when ColonTime present', () => {
    const tokens = tokenize('10');
    const context = makeContext({ hasColonTime: true });
    const candidates = tagCandidates(tokens, context);
    applyContextRules(candidates, tokens, context);
    expect(candidates[0].scores.hour).toBe(0);
    expect(candidates[0].scores.minute).toBe(0);
    expect(candidates[0].scores.second).toBe(0);
    expect(candidates[0].scores.ms).toBe(0);
  });

  it('zeros hour/minute/second/ms when TimeKeyword present', () => {
    const tokens = tokenize('10');
    const context = makeContext({ hasTimeKeyword: true });
    const candidates = tagCandidates(tokens, context);
    applyContextRules(candidates, tokens, context);
    expect(candidates[0].scores.hour).toBe(0);
  });

  it('boosts day for number adjacent to MonthName (after)', () => {
    const tokens = tokenize('nov 10');
    const context = makeContext({ hasMonthName: true });
    const candidates = tagCandidates(tokens, context);
    const baseDayScore = candidates[0].scores.day;
    applyContextRules(candidates, tokens, context);
    expect(candidates[0].scores.day).toBe(baseDayScore + 0.5 + 0.3);
  });

  it('boosts day for number adjacent to MonthName (before)', () => {
    const tokens = tokenize('10 nov');
    const context = makeContext({ hasMonthName: true });
    const candidates = tagCandidates(tokens, context);
    const baseDayScore = candidates[0].scores.day;
    applyContextRules(candidates, tokens, context);
    expect(candidates[0].scores.day).toBe(baseDayScore + 0.5 + 0.3);
  });

  it('applies position boost for date keyword (time order)', () => {
    const tokens = tokenize('10 30');
    const context = makeContext({ hasDateKeyword: true });
    const candidates = tagCandidates(tokens, context);
    applyContextRules(candidates, tokens, context);
    expect(candidates[0].scores.hour).toBeGreaterThan(0);
    expect(candidates[1].scores.minute).toBeGreaterThan(0);
  });

  it('applies AM/PM influence to candidate with highest hour score', () => {
    const tokens = tokenize('10');
    const context = makeContext({ hasAmPm: true });
    const candidates = tagCandidates(tokens, context);
    const hourBefore = candidates[0].scores.hour;
    applyContextRules(candidates, tokens, context);
    expect(candidates[0].scores.hour).toBe(hourBefore + 0.2);
  });

  it('zeros day for Number candidates when Ordinal present', () => {
    const tokens = tokenize('15th 10');
    const context = makeContext({ hasOrdinal: true });
    const candidates = tagCandidates(tokens, context);
    const numberCandidate = candidates.find(c => c.token.kind === ETokenKind.Number);
    applyContextRules(candidates, tokens, context);
    expect(numberCandidate?.scores.day).toBe(0);
  });
});

describe('resolveSlots', () => {
  it('assigns 4-digit number to year (certain assignment)', () => {
    const tokens = tokenize('2025');
    const context = makeContext();
    const candidates = tagCandidates(tokens, context);
    applyContextRules(candidates, tokens, context);
    const result = resolveSlots(candidates);
    expect(result).toBeDefined();
    expect(result?.get(candidates[0])).toBe('year');
  });

  it('assigns 3-digit number to ms (certain assignment)', () => {
    const tokens = tokenize('123');
    const context = makeContext();
    const candidates = tagCandidates(tokens, context);
    applyContextRules(candidates, tokens, context);
    const result = resolveSlots(candidates);
    expect(result).toBeDefined();
    expect(result?.get(candidates[0])).toBe('ms');
  });

  it('assigns multiple numbers via greedy resolution', () => {
    const tokens = tokenize('15 3 2025');
    const context = makeContext();
    const candidates = tagCandidates(tokens, context);
    applyContextRules(candidates, tokens, context);
    const result = resolveSlots(candidates);
    expect(result).toBeDefined();
    expect(result?.get(candidates[0])).toBe('day');
    expect(result?.get(candidates[1])).toBe('month');
    expect(result?.get(candidates[2])).toBe('year');
  });

  it('returns defined for empty candidates', () => {
    const result = resolveSlots([]);
    expect(result).toBeDefined();
    expect(result?.size).toBe(0);
  });
});

describe('parseTokenBased', () => {
  const tokenToday = Temporal.PlainDate.from('2025-03-15');

  it('parses "10 nov 10 30" as 10 Nov at 10:30', () => {
    const result = parseTokenBased('10 nov 10 30', tokenToday, 'UTC');
    expect(result).toBeDefined();
    expect(result?.toPlainDate().month).toBe(11);
    expect(result?.toPlainDate().day).toBe(10);
    expect(result?.hour).toBe(10);
    expect(result?.minute).toBe(30);
  });

  it('parses "tomorrow noon" as tomorrow 12:00', () => {
    const result = parseTokenBased('tomorrow noon', tokenToday, 'UTC');
    expect(result).toBeDefined();
    expect(result?.toPlainDate().toString()).toBe('2025-03-16');
    expect(result?.hour).toBe(12);
  });

  it('returns undefined for "tom now" (conflict)', () => {
    const result = parseTokenBased('tom now', tokenToday, 'UTC');
    expect(result).toBeUndefined();
  });

  it('returns undefined for "1d yesterday" (conflict)', () => {
    const result = parseTokenBased('1d yesterday', tokenToday, 'UTC');
    expect(result).toBeUndefined();
  });

  it('parses "15 3 2025 14" as 15 Mar 2025 14:00', () => {
    const result = parseTokenBased('15 3 2025 14', tokenToday, 'UTC');
    expect(result).toBeDefined();
    expect(result?.toPlainDate().toString()).toBe('2025-03-15');
    expect(result?.hour).toBe(14);
  });

  it('returns undefined for unknown tokens', () => {
    const result = parseTokenBased('gibberish stuff', tokenToday, 'UTC');
    expect(result).toBeUndefined();
  });

  it('returns undefined for empty input', () => {
    const result = parseTokenBased('', tokenToday, 'UTC');
    expect(result).toBeUndefined();
  });

  it('parses "today 9am" as today at 09:00', () => {
    const result = parseTokenBased('today 9am', tokenToday, 'UTC');
    expect(result).toBeDefined();
    expect(result?.toPlainDate().toString()).toBe('2025-03-15');
    expect(result?.hour).toBe(9);
  });

  it('parses "15th nov" as 15 Nov', () => {
    const result = parseTokenBased('15th nov', tokenToday, 'UTC');
    expect(result).toBeDefined();
    expect(result?.toPlainDate().month).toBe(11);
    expect(result?.toPlainDate().day).toBe(15);
  });

  it('returns undefined for too many tokens', () => {
    const result = parseTokenBased('1 2 3 4 5 6 7 8', tokenToday, 'UTC');
    expect(result).toBeUndefined();
  });

  it('parses "yesterday 5:30pm" as yesterday at 17:30', () => {
    const result = parseTokenBased('yesterday 5:30pm', tokenToday, 'UTC');
    expect(result).toBeDefined();
    expect(result?.toPlainDate().toString()).toBe('2025-03-14');
    expect(result?.hour).toBe(17);
    expect(result?.minute).toBe(30);
  });

  it('parses "today midnight" as today at 00:00', () => {
    const result = parseTokenBased('today midnight', tokenToday, 'UTC');
    expect(result).toBeDefined();
    expect(result?.toPlainDate().toString()).toBe('2025-03-15');
    expect(result?.hour).toBe(0);
  });

  it('parses "15th nov 2025" as 15 Nov 2025', () => {
    const result = parseTokenBased('15th nov 2025', tokenToday, 'UTC');
    expect(result).toBeDefined();
    expect(result?.toPlainDate().toString()).toBe('2025-11-15');
  });

  it('returns undefined for conflicting time keywords "noon midnight"', () => {
    const result = parseTokenBased('noon midnight', tokenToday, 'UTC');
    expect(result).toBeUndefined();
  });

  it('parses "nov 10 14 30" as 10 Nov at 14:30 (month adjacency)', () => {
    const result = parseTokenBased('nov 10 14 30', tokenToday, 'UTC');
    expect(result).toBeDefined();
    expect(result?.toPlainDate().month).toBe(11);
    expect(result?.toPlainDate().day).toBe(10);
    expect(result?.hour).toBe(14);
    expect(result?.minute).toBe(30);
  });

  it('parses "10 jan 2025 9" as 10 Jan 2025 09:00 (month adjacency)', () => {
    const result = parseTokenBased('10 jan 2025 9', tokenToday, 'UTC');
    expect(result).toBeDefined();
    expect(result?.toPlainDate().toString()).toBe('2025-01-10');
    expect(result?.hour).toBe(9);
  });

  it('parses "2025 3 15 10 30" as 15 Mar 2025 10:30 (4-digit year certain)', () => {
    const result = parseTokenBased('2025 3 15 10 30', tokenToday, 'UTC');
    expect(result).toBeDefined();
    expect(result?.toPlainDate().toString()).toBe('2025-03-15');
    expect(result?.hour).toBe(10);
    expect(result?.minute).toBe(30);
  });

  it('parses "10 11 82 10 40 50 80" as 10 Nov 1982 10:40:50.800', () => {
    const result = parseTokenBased('10 11 82 10 40 50 80', tokenToday, 'UTC');
    expect(result).toBeDefined();
    expect(result?.toPlainDate().day).toBe(10);
    expect(result?.toPlainDate().month).toBe(11);
    expect(result?.toPlainDate().year).toBe(1982);
    expect(result?.hour).toBe(10);
    expect(result?.minute).toBe(40);
    expect(result?.second).toBe(50);
  });

  it('parses "tom 14" as tomorrow at 14:00', () => {
    const result = parseTokenBased('tom 14', tokenToday, 'UTC');
    expect(result).toBeDefined();
    expect(result?.toPlainDate().toString()).toBe('2025-03-16');
    expect(result?.hour).toBe(14);
  });
});
