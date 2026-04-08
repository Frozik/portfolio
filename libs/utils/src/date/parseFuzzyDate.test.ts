import { Temporal } from '@js-temporal/polyfill';
import { describe, expect, it } from 'vitest';
import { parseFuzzyDate } from './parseFuzzyDate';
import type { DateTimeParseResult } from './types';

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

  describe('keywords', () => {
    it('parses "today"', () => expectDate('today', '2024-06-15'));
    it('parses "tomorrow"', () => expectDate('tomorrow', '2024-06-16'));
    it('parses "yesterday"', () => expectDate('yesterday', '2024-06-14'));
    it('parses "noon"', () => expectDateTime('noon', '2024-06-15', 12, 0));
    it('parses "midnight"', () => expectDateTime('midnight', '2024-06-15', 0, 0));
  });

  describe('boundary keywords', () => {
    it('parses "eom"', () => expectDate('eom', '2024-06-30'));
    it('parses "bom" (June 1 is past → July 1)', () => expectDate('bom', '2024-07-01'));
    it('parses "eoy"', () => expectDate('eoy', '2024-12-31'));
    it('parses "boy" (Jan 1 is past → 2025)', () => expectDate('boy', '2025-01-01'));
    it('parses "eoq"', () => expectDate('eoq', '2024-06-30'));
  });

  describe('offsets', () => {
    it('parses "+3d"', () => expectDate('+3d', '2024-06-18'));
    it('parses "-1w"', () => expectDate('-1w', '2024-06-08'));
    it('parses "+2m"', () => expectDate('+2m', '2024-08-15'));
    it('parses "+1y"', () => expectDate('+1y', '2025-06-15'));

    it('parses "3w"', () => expectDate('3w', '2024-07-06'));
    it('parses "1d"', () => expectDate('1d', '2024-06-16'));
    it('parses "1m"', () => expectDate('1m', '2024-07-15'));
    it('parses "1y"', () => expectDate('1y', '2025-06-15'));
    it('parses "2w"', () => expectDate('2w', '2024-06-29'));

    it('parses "in 3 days"', () => expectDate('in 3 days', '2024-06-18'));
    it('parses "in 2 weeks"', () => expectDate('in 2 weeks', '2024-06-29'));
    it('parses "in 1 month"', () => expectDate('in 1 month', '2024-07-15'));
    it('parses "3 days ago"', () => expectDate('3 days ago', '2024-06-12'));
    it('parses "2 weeks ago"', () => expectDate('2 weeks ago', '2024-06-01'));
    it('parses "1 year ago"', () => expectDate('1 year ago', '2023-06-15'));
  });

  describe('weekdays', () => {
    it('parses "mon" (Saturday → next Monday)', () => expectDate('mon', '2024-06-17'));
    it('parses "tuesday"', () => expectDate('tuesday', '2024-06-18'));
    it('parses "next monday"', () => expectDate('next monday', '2024-06-17'));
    it('parses "next friday"', () => expectDate('next friday', '2024-06-21'));
    it('parses "last monday"', () => expectDate('last monday', '2024-06-10'));
    it('parses "last friday"', () => expectDate('last friday', '2024-06-14'));
  });

  describe('date with month name', () => {
    it('parses "15 jan 2025"', () => expectDate('15 jan 2025', '2025-01-15'));
    it('parses "15th january 2025"', () => expectDate('15th january 2025', '2025-01-15'));
    it('parses "jan 15 2025"', () => expectDate('jan 15 2025', '2025-01-15'));
    it('parses "jan 15, 2025"', () => expectDate('jan 15, 2025', '2025-01-15'));
    it('parses "january 1st, 2025"', () => expectDate('january 1st, 2025', '2025-01-01'));
    it('parses "15 jan \'25"', () => expectDate("15 jan '25", '2025-01-15'));

    it('parses "15 jan 27"', () => expectDate('15 jan 27', '2027-01-15'));
    it('parses "jan 15 27"', () => expectDate('jan 15 27', '2027-01-15'));

    it('parses "15 jan" (future)', () => expectDate('15 jan', '2025-01-15'));
    it('parses "jan 15" (future)', () => expectDate('jan 15', '2025-01-15'));
    it('parses "15th december" (future this year)', () =>
      expectDate('15th december', '2024-12-15'));
    it('parses "1 jul" (future this year)', () => expectDate('1 jul', '2024-07-01'));

    it('parses "10nov" (concatenated day+month)', () => expectDate('10nov', '2024-11-10'));
    it('parses "1jan" (concatenated day+month)', () => expectDate('1jan', '2025-01-01'));
    it('parses "January20" (concatenated month+day)', () => expectDate('January20', '2025-01-20'));
    it('parses "nov10" (concatenated month+day)', () => expectDate('nov10', '2024-11-10'));
    it('parses "dec25" (concatenated month+day)', () => expectDate('dec25', '2024-12-25'));
    it('parses "15nov2025" (concatenated day+month+year)', () =>
      expectDate('15nov2025', '2025-11-15'));
    it('parses "January20 2025" (concatenated month+day + year)', () =>
      expectDate('January20 2025', '2025-01-20'));
  });

  describe('numeric dates', () => {
    it('parses "2024-06-01"', () => expectDate('2024-06-01', '2024-06-01'));
    it('parses "15/03/2024"', () => expectDate('15/03/2024', '2024-03-15'));
    it('parses "15.03.2024"', () => expectDate('15.03.2024', '2024-03-15'));

    it('parses "15 06 27"', () => expectDate('15 06 27', '2027-06-15'));
    it('parses "15 06 2027"', () => expectDate('15 06 2027', '2027-06-15'));
    it('parses "1 1 25"', () => expectDate('1 1 25', '2025-01-01'));
  });

  describe('quarters', () => {
    it('parses "Q1" (Q1 is past → 2025)', () => expectDate('Q1', '2025-01-01'));
    it('parses "Q2 2025"', () => expectDate('Q2 2025', '2025-04-01'));
    it('parses "Q3/2025"', () => expectDate('Q3/2025', '2025-07-01'));
    it('parses "1Q25"', () => expectDate('1Q25', '2025-01-01'));
    it('parses "4Q2025"', () => expectDate('4Q2025', '2025-10-01'));
  });

  describe('month + year', () => {
    it('parses "jan 2027"', () => expectDate('jan 2027', '2027-01-01'));
    it('parses "january 2027"', () => expectDate('january 2027', '2027-01-01'));
    it('parses "2027 jan"', () => expectDate('2027 jan', '2027-01-01'));
    it('parses "jan \'27"', () => expectDate("jan '27", '2027-01-01'));
    it('parses "2027-01" (ISO month)', () => expectDate('2027-01', '2027-01-01'));
    it('parses "01/2027" (slash month)', () => expectDate('01/2027', '2027-01-01'));
  });

  describe('month only', () => {
    it('parses "jan" → next January', () => expectDate('jan', '2025-01-01'));
    it('parses "december" → this year', () => expectDate('december', '2024-12-01'));
  });

  describe('ordinals', () => {
    it('parses "15th" as today (June 15)', () => expectDate('15th', '2024-06-15'));
    it('parses "the 1st" as next month (July 1, since June 1 is past)', () =>
      expectDate('the 1st', '2024-07-01'));
    it('parses "22nd" as June 22 (still future)', () => expectDate('22nd', '2024-06-22'));
  });

  describe('standalone time', () => {
    it('parses "13:00" as today at 13:00', () => expectDateTime('13:00', '2024-06-15', 13, 0));
    it('parses "00:30" as today at 00:30', () => expectDateTime('00:30', '2024-06-15', 0, 30));
    it('parses "9:30:45" with seconds', () => expectDateTime('9:30:45', '2024-06-15', 9, 30, 45));
    it('parses "9:30:45.123" with milliseconds', () =>
      expectDateTime('9:30:45.123', '2024-06-15', 9, 30, 45, 123));
    it('parses "9am"', () => expectDateTime('9am', '2024-06-15', 9, 0));
    it('parses "2pm"', () => expectDateTime('2pm', '2024-06-15', 14, 0));
    it('parses "12am" as 0:00', () => expectDateTime('12am', '2024-06-15', 0, 0));
    it('parses "12pm" as 12:00', () => expectDateTime('12pm', '2024-06-15', 12, 0));
    it('parses "5:30pm"', () => expectDateTime('5:30pm', '2024-06-15', 17, 30));
  });

  describe('keyword + time', () => {
    it('parses "tom 13:00"', () => expectDateTime('tom 13:00', '2024-06-16', 13, 0));
    it('parses "tom 13:00:30"', () => expectDateTime('tom 13:00:30', '2024-06-16', 13, 0, 30));
    it('parses "tom 13:00:30.900"', () =>
      expectDateTime('tom 13:00:30.900', '2024-06-16', 13, 0, 30, 900));
    it('parses "tomorrow 9am"', () => expectDateTime('tomorrow 9am', '2024-06-16', 9, 0));
    it('parses "yesterday 23:00"', () => expectDateTime('yesterday 23:00', '2024-06-14', 23, 0));
    it('parses "today 15:30"', () => expectDateTime('today 15:30', '2024-06-15', 15, 30));
    it('parses "eom 23:59"', () => expectDateTime('eom 23:59', '2024-06-30', 23, 59));
  });

  describe('weekday + time', () => {
    it('parses "mon 9:30"', () => expectDateTime('mon 9:30', '2024-06-17', 9, 30));
    it('parses "mon 2pm"', () => expectDateTime('mon 2pm', '2024-06-17', 14, 0));
    it('parses "fri 5:30pm"', () => expectDateTime('fri 5:30pm', '2024-06-21', 17, 30));
    it('parses "next fri 17:00"', () => expectDateTime('next fri 17:00', '2024-06-21', 17, 0));
    it('parses "last mon 9am"', () => expectDateTime('last mon 9am', '2024-06-10', 9, 0));
  });

  describe('offset + time', () => {
    it('parses "+3d 8:00"', () => expectDateTime('+3d 8:00', '2024-06-18', 8, 0));
    it('parses "+1w 9:00"', () => expectDateTime('+1w 9:00', '2024-06-22', 9, 0));
    it('parses "-2d 18:00"', () => expectDateTime('-2d 18:00', '2024-06-13', 18, 0));
    it('parses "in 3 days 8am"', () => expectDateTime('in 3 days 8am', '2024-06-18', 8, 0));
  });

  describe('date with month name + time', () => {
    it('parses "15 jan 2025 14:30:00"', () =>
      expectDateTime('15 jan 2025 14:30:00', '2025-01-15', 14, 30));
    it('parses "15 dec 2024 8:15"', () => expectDateTime('15 dec 2024 8:15', '2024-12-15', 8, 15));
    it('parses "1 jul 9am"', () => expectDateTime('1 jul 9am', '2024-07-01', 9, 0));
    it('parses "jan 10 17" as Jan 10 at 17:00', () =>
      expectDateTime('jan 10 17', '2025-01-10', 17, 0));
  });

  describe('numeric date + time', () => {
    it('parses "15.03.2024 18:00"', () => expectDateTime('15.03.2024 18:00', '2024-03-15', 18, 0));
    it('parses "15/03/2024 18:00"', () => expectDateTime('15/03/2024 18:00', '2024-03-15', 18, 0));
    it('parses "2025-01-15 9:30:45.123"', () =>
      expectDateTime('2025-01-15 9:30:45.123', '2025-01-15', 9, 30, 45, 123));
    it('parses "2024-01-15T14:30" (ISO datetime)', () =>
      expectDateTime('2024-01-15T14:30', '2024-01-15', 14, 30));
  });

  describe('ambiguous year vs hour (third token <= 23 = hour, > 23 = year)', () => {
    it('parses "10 nov 82" as Nov 10, 1982 (82 > 23 → year)', () =>
      expectDate('10 nov 82', '1982-11-10'));
    it('parses "10 nov 10" as Nov 10 at 10:00 (10 <= 23 → hour)', () =>
      expectDateTime('10 nov 10', '2024-11-10', 10, 0));
    it('parses "10 nov 82 10" as Nov 10, 1982 at 10:00', () =>
      expectDateTime('10 nov 82 10', '1982-11-10', 10, 0));
    it('parses "10 nov 10 40" as Nov 10 at 10:40', () =>
      expectDateTime('10 nov 10 40', '2024-11-10', 10, 40));
    it('parses "10 nov 2082 10:40" as Nov 10, 2082 at 10:40', () =>
      expectDateTime('10 nov 2082 10:40', '2082-11-10', 10, 40));
  });

  describe('failure cases', () => {
    it('returns failure for empty input', () => {
      expect(parse('').success).toBe(false);
    });

    it('returns failure for unparseable input', () => {
      expect(parse('gibberish').success).toBe(false);
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
      it('"13:00" when now is 14:00 → tomorrow 13:00', () =>
        expectDateTimeAt14('13:00', '2024-06-16', 13, 0));
      it('"15:00" when now is 14:00 → today 15:00 (already future)', () =>
        expectDateTimeAt14('15:00', '2024-06-15', 15, 0));
      it('"00:30" when now is 14:00 → tomorrow 00:30', () =>
        expectDateTimeAt14('00:30', '2024-06-16', 0, 30));
      it('"9am" when now is 14:00 → tomorrow 9:00', () =>
        expectDateTimeAt14('9am', '2024-06-16', 9, 0));
      it('"3pm" when now is 14:00 → today 15:00', () =>
        expectDateTimeAt14('3pm', '2024-06-15', 15, 0));
    });

    describe('keyword time', () => {
      it('"noon" when now is 14:00 → tomorrow 12:00', () =>
        expectDateTimeAt14('noon', '2024-06-16', 12, 0));
      it('"midnight" when now is 14:00 → tomorrow 00:00', () =>
        expectDateTimeAt14('midnight', '2024-06-16', 0, 0));
    });

    describe('weekday + time', () => {
      const nowTue14 = Temporal.ZonedDateTime.from('2024-06-18T14:00:00[UTC]');

      function parseTue14(input: string): DateTimeParseResult {
        return parseFuzzyDate(input, { now: nowTue14 });
      }

      it('"tue 13:00" when now is Tue 14:00 → next Tue 13:00', () => {
        const result = parseTue14('tue 13:00');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.value.toPlainDate().toString()).toBe('2024-06-25');
          expect(result.value.hour).toBe(13);
          expect(result.value.minute).toBe(0);
        }
      });

      it('"tue 15:00" when now is Tue 14:00 → next Tue 15:00', () => {
        const result = parseTue14('tue 15:00');
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.value.toPlainDate().toString()).toBe('2024-06-25');
          expect(result.value.hour).toBe(15);
          expect(result.value.minute).toBe(0);
        }
      });

      it('"mon" on Saturday → next Monday (already future)', () =>
        expectDateAt14('mon', '2024-06-17'));
    });

    describe('day of month', () => {
      it('"15th" when now is Jun 15 14:00 → Jul 15 (Jun 15 00:00 is past)', () =>
        expectDateAt14('15th', '2024-07-15'));
      it('"22nd" when now is Jun 15 14:00 → Jun 22 (already future)', () =>
        expectDateAt14('22nd', '2024-06-22'));
    });

    describe('month + day', () => {
      it('"jan 15" when now is Jun 15 → Jan 15 2025', () => expectDateAt14('jan 15', '2025-01-15'));
      it('"jun 14" when now is Jun 15 → Jun 14 2025', () => expectDateAt14('jun 14', '2025-06-14'));
    });

    describe('explicit past-directed (should NOT advance)', () => {
      it('"yesterday" stays in past', () => expectDateAt14('yesterday', '2024-06-14'));
      it('"-2d" stays in past', () => expectDateAt14('-2d', '2024-06-13'));
      it('"last monday" stays in past', () => expectDateAt14('last monday', '2024-06-10'));
      it('"3 days ago" stays in past', () => expectDateAt14('3 days ago', '2024-06-12'));
    });

    describe('explicit date (should NOT advance)', () => {
      it('"2024-01-15" stays in past', () => expectDateAt14('2024-01-15', '2024-01-15'));
      it('"15/03/2024" stays in past', () => expectDateAt14('15/03/2024', '2024-03-15'));
    });

    describe('future-directed (already future, no change)', () => {
      it('"tomorrow" is always future', () => expectDateAt14('tomorrow', '2024-06-16'));
      it('"+3d" is always future', () => expectDateAt14('+3d', '2024-06-18'));
      it('"in 2 weeks" is always future', () => expectDateAt14('in 2 weeks', '2024-06-29'));
    });

    describe('boundary keywords', () => {
      it('"eom" stays as end of current month', () => expectDateAt14('eom', '2024-06-30'));
    });

    describe('compound: keyword + time', () => {
      it('"today 13:00" when now is 14:00 → stays as today 13:00 (today is explicit)', () =>
        expectDateTimeAt14('today 13:00', '2024-06-15', 13, 0));
      it('"eom 23:59" → boundary, stays as-is', () =>
        expectDateTimeAt14('eom 23:59', '2024-06-30', 23, 59));
      it('"tom 13:00" → future directed, already future', () =>
        expectDateTimeAt14('tom 13:00', '2024-06-16', 13, 0));
    });
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

    it('"13:00" resolves to today 13:00 (not tomorrow)', () =>
      expectNearestDateTime('13:00', '2024-06-15', 13, 0));
    it('"9am" resolves to today 9:00 (not tomorrow)', () =>
      expectNearestDateTime('9am', '2024-06-15', 9, 0));
    it('"noon" resolves to today 12:00 (not tomorrow)', () =>
      expectNearestDateTime('noon', '2024-06-15', 12, 0));
    it('"midnight" resolves to today 00:00 (not tomorrow)', () =>
      expectNearestDateTime('midnight', '2024-06-15', 0, 0));
    it('"15th" resolves to Jun 15 (not Jul 15)', () => expectNearestDate('15th', '2024-06-15'));
    it('"15:00" still resolves to today 15:00 (future anyway)', () =>
      expectNearestDateTime('15:00', '2024-06-15', 15, 0));
    it('"yesterday" still works', () => expectNearestDate('yesterday', '2024-06-14'));
    it('"tomorrow" still works', () => expectNearestDate('tomorrow', '2024-06-16'));
    it('"+3d" still works', () => expectNearestDate('+3d', '2024-06-18'));
    it('"2024-01-15" explicit date stays as-is', () =>
      expectNearestDate('2024-01-15', '2024-01-15'));
  });
});
