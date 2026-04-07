import { Temporal } from '@js-temporal/polyfill';
import { describe, expect, it } from 'vitest';
import {
  applyOffset,
  createDateTimeParser,
  parseDirectDate,
  parseStandaloneTime,
  resolveKeyword,
  resolveMonthName,
  resolveMonthYear,
  resolveNextWeekday,
  resolvePreviousWeekday,
  resolveQuarter,
} from './parseDateTimeInput';
import type { DateTimeParseResult } from './types';

const TIME_ZONE = 'UTC';

// ── resolveNextWeekday ────────────────────────────────────────────────

describe('resolveNextWeekday', () => {
  const monday = Temporal.PlainDate.from('2024-01-08'); // Monday

  it('resolves "tue" to next Tuesday', () => {
    expect(resolveNextWeekday('tue', monday)?.toString()).toBe('2024-01-09');
  });

  it('resolves "mon" on Monday to NEXT Monday', () => {
    expect(resolveNextWeekday('mon', monday)?.toString()).toBe('2024-01-15');
  });

  it('resolves full name "friday"', () => {
    expect(resolveNextWeekday('friday', monday)?.toString()).toBe('2024-01-12');
  });

  it('is case-insensitive', () => {
    expect(resolveNextWeekday('WED', monday)?.toString()).toBe('2024-01-10');
  });

  it('returns undefined for invalid input', () => {
    expect(resolveNextWeekday('xyz', monday)).toBeUndefined();
  });
});

// ── resolvePreviousWeekday ────────────────────────────────────────────

describe('resolvePreviousWeekday', () => {
  const wednesday = Temporal.PlainDate.from('2024-01-10'); // Wednesday

  it('resolves "mon" to previous Monday', () => {
    expect(resolvePreviousWeekday('mon', wednesday)?.toString()).toBe('2024-01-08');
  });

  it('resolves "wed" on Wednesday to PREVIOUS Wednesday', () => {
    expect(resolvePreviousWeekday('wed', wednesday)?.toString()).toBe('2024-01-03');
  });

  it('resolves "friday" to previous Friday', () => {
    expect(resolvePreviousWeekday('friday', wednesday)?.toString()).toBe('2024-01-05');
  });
});

// ── resolveKeyword ────────────────────────────────────────────────────

describe('resolveKeyword', () => {
  const today = Temporal.PlainDate.from('2024-01-15');

  it('resolves "yesterday"', () => {
    expect(resolveKeyword('yesterday', today, TIME_ZONE)?.toPlainDate().toString()).toBe(
      '2024-01-14'
    );
  });

  it('resolves "tomorrow"', () => {
    expect(resolveKeyword('tomorrow', today, TIME_ZONE)?.toPlainDate().toString()).toBe(
      '2024-01-16'
    );
  });

  it('resolves "today"', () => {
    expect(resolveKeyword('today', today, TIME_ZONE)?.toPlainDate().toString()).toBe('2024-01-15');
  });

  it('resolves "now"', () => {
    expect(resolveKeyword('now', today, TIME_ZONE)?.toPlainDate().toString()).toBe('2024-01-15');
  });

  it('resolves "tom" as tomorrow', () => {
    expect(resolveKeyword('tom', today, TIME_ZONE)?.toPlainDate().toString()).toBe('2024-01-16');
  });

  it('resolves "noon" to 12:00', () => {
    const result = resolveKeyword('noon', today, TIME_ZONE);
    expect(result?.hour).toBe(12);
    expect(result?.minute).toBe(0);
  });

  it('resolves "midday" to 12:00', () => {
    const result = resolveKeyword('midday', today, TIME_ZONE);
    expect(result?.hour).toBe(12);
  });

  it('resolves "midnight" to 00:00', () => {
    const result = resolveKeyword('midnight', today, TIME_ZONE);
    expect(result?.hour).toBe(0);
    expect(result?.minute).toBe(0);
  });

  it('resolves "eom" to end of month', () => {
    expect(resolveKeyword('eom', today, TIME_ZONE)?.toPlainDate().toString()).toBe('2024-01-31');
  });

  it('resolves "end of month"', () => {
    expect(resolveKeyword('end of month', today, TIME_ZONE)?.toPlainDate().toString()).toBe(
      '2024-01-31'
    );
  });

  it('resolves "bom" to next month 1st when past', () => {
    expect(resolveKeyword('bom', today, TIME_ZONE)?.toPlainDate().toString()).toBe('2024-02-01');
  });

  it('resolves "bom" to current month 1st on the 1st', () => {
    const firstDay = Temporal.PlainDate.from('2024-03-01');
    expect(resolveKeyword('bom', firstDay, TIME_ZONE)?.toPlainDate().toString()).toBe('2024-03-01');
  });

  it('resolves "eoy" to end of year', () => {
    expect(resolveKeyword('eoy', today, TIME_ZONE)?.toPlainDate().toString()).toBe('2024-12-31');
  });

  it('resolves "boy" to next year Jan 1 when past', () => {
    expect(resolveKeyword('boy', today, TIME_ZONE)?.toPlainDate().toString()).toBe('2025-01-01');
  });

  it('resolves "boy" to current year Jan 1 on Jan 1', () => {
    const jan1 = Temporal.PlainDate.from('2024-01-01');
    expect(resolveKeyword('boy', jan1, TIME_ZONE)?.toPlainDate().toString()).toBe('2024-01-01');
  });

  it('resolves "eoq" to end of quarter', () => {
    expect(resolveKeyword('eoq', today, TIME_ZONE)?.toPlainDate().toString()).toBe('2024-03-31');
  });

  it('resolves "end of quarter"', () => {
    const q3Today = Temporal.PlainDate.from('2024-08-10');
    expect(resolveKeyword('end of quarter', q3Today, TIME_ZONE)?.toPlainDate().toString()).toBe(
      '2024-09-30'
    );
  });

  it('returns undefined for unknown keyword', () => {
    expect(resolveKeyword('blah', today, TIME_ZONE)).toBeUndefined();
  });
});

// ── resolveMonthName ──────────────────────────────────────────────────

describe('resolveMonthName', () => {
  const today = Temporal.PlainDate.from('2024-06-15');

  it('resolves future month in current year', () => {
    expect(resolveMonthName('dec', today)?.toString()).toBe('2024-12-01');
  });

  it('resolves past month to next year', () => {
    expect(resolveMonthName('jan', today)?.toString()).toBe('2025-01-01');
  });

  it('resolves full name "september"', () => {
    expect(resolveMonthName('september', today)?.toString()).toBe('2024-09-01');
  });

  it('returns undefined for invalid name', () => {
    expect(resolveMonthName('xyz', today)).toBeUndefined();
  });
});

// ── resolveMonthYear ──────────────────────────────────────────────────

describe('resolveMonthYear', () => {
  it('resolves "jan" + 2027', () => {
    expect(resolveMonthYear('jan', 2027)?.toString()).toBe('2027-01-01');
  });

  it('resolves full name + year', () => {
    expect(resolveMonthYear('december', 2025)?.toString()).toBe('2025-12-01');
  });

  it('returns undefined for invalid name', () => {
    expect(resolveMonthYear('xyz', 2025)).toBeUndefined();
  });
});

// ── resolveQuarter ────────────────────────────────────────────────────

describe('resolveQuarter', () => {
  it('Q1 → Jan 1', () => {
    expect(resolveQuarter(1, 2025)?.toString()).toBe('2025-01-01');
  });

  it('Q2 → Apr 1', () => {
    expect(resolveQuarter(2, 2025)?.toString()).toBe('2025-04-01');
  });

  it('Q3 → Jul 1', () => {
    expect(resolveQuarter(3, 2025)?.toString()).toBe('2025-07-01');
  });

  it('Q4 → Oct 1', () => {
    expect(resolveQuarter(4, 2025)?.toString()).toBe('2025-10-01');
  });

  it('returns undefined for invalid quarter', () => {
    expect(resolveQuarter(5, 2025)).toBeUndefined();
  });
});

// ── applyOffset ───────────────────────────────────────────────────────

describe('applyOffset', () => {
  const today = Temporal.PlainDate.from('2024-01-15');

  it('+3 days', () => {
    expect(applyOffset(today, 3, 'd', 1).toString()).toBe('2024-01-18');
  });

  it('-2 weeks', () => {
    expect(applyOffset(today, 2, 'w', -1).toString()).toBe('2024-01-01');
  });

  it('+1 month', () => {
    expect(applyOffset(today, 1, 'm', 1).toString()).toBe('2024-02-15');
  });

  it('+1 year', () => {
    expect(applyOffset(today, 1, 'y', 1).toString()).toBe('2025-01-15');
  });
});

// ── parseDirectDate ───────────────────────────────────────────────────

describe('parseDirectDate', () => {
  it('parses ISO date', () => {
    expect(parseDirectDate('2024-03-15', TIME_ZONE)?.toPlainDate().toString()).toBe('2024-03-15');
  });

  it('parses DD/MM/YYYY', () => {
    expect(parseDirectDate('15/03/2024', TIME_ZONE)?.toPlainDate().toString()).toBe('2024-03-15');
  });

  it('parses DD.MM.YYYY', () => {
    expect(parseDirectDate('15.03.2024', TIME_ZONE)?.toPlainDate().toString()).toBe('2024-03-15');
  });

  it('parses DD-MM-YYYY', () => {
    expect(parseDirectDate('15-03-2024', TIME_ZONE)?.toPlainDate().toString()).toBe('2024-03-15');
  });

  it('parses ISO datetime', () => {
    const result = parseDirectDate('2024-03-15T14:30', TIME_ZONE);
    expect(result?.toPlainDate().toString()).toBe('2024-03-15');
    expect(result?.hour).toBe(14);
    expect(result?.minute).toBe(30);
  });

  it('returns undefined for invalid date', () => {
    expect(parseDirectDate('not-a-date', TIME_ZONE)).toBeUndefined();
  });
});

// ── createDateTimeParser (integration) ────────────────────────────────

describe('createDateTimeParser', () => {
  const today = Temporal.PlainDate.from('2024-06-15'); // Saturday

  function parse(input: string): DateTimeParseResult {
    return createDateTimeParser({ today, timeZone: TIME_ZONE })(input);
  }

  function expectDate(input: string, expected: string): void {
    const result = parse(input);
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.toPlainDate().toString()).toBe(expected);
    }
  }

  // Keywords
  it('parses "today"', () => expectDate('today', '2024-06-15'));
  it('parses "tomorrow"', () => expectDate('tomorrow', '2024-06-16'));
  it('parses "yesterday"', () => expectDate('yesterday', '2024-06-14'));
  it('parses "eom"', () => expectDate('eom', '2024-06-30'));
  it('parses "bom" (June 1 is past → July 1)', () => expectDate('bom', '2024-07-01'));
  it('parses "eoy"', () => expectDate('eoy', '2024-12-31'));
  it('parses "boy" (Jan 1 is past → 2025)', () => expectDate('boy', '2025-01-01'));
  it('parses "eoq"', () => expectDate('eoq', '2024-06-30'));

  // Offsets
  it('parses "+3d"', () => expectDate('+3d', '2024-06-18'));
  it('parses "-1w"', () => expectDate('-1w', '2024-06-08'));
  it('parses "+2m"', () => expectDate('+2m', '2024-08-15'));
  it('parses "+1y"', () => expectDate('+1y', '2025-06-15'));

  // Relative expressions
  it('parses "in 3 days"', () => expectDate('in 3 days', '2024-06-18'));
  it('parses "in 2 weeks"', () => expectDate('in 2 weeks', '2024-06-29'));
  it('parses "in 1 month"', () => expectDate('in 1 month', '2024-07-15'));
  it('parses "3 days ago"', () => expectDate('3 days ago', '2024-06-12'));
  it('parses "2 weeks ago"', () => expectDate('2 weeks ago', '2024-06-01'));
  it('parses "1 year ago"', () => expectDate('1 year ago', '2023-06-15'));

  // next/last weekday
  it('parses "next monday"', () => expectDate('next monday', '2024-06-17'));
  it('parses "next friday"', () => expectDate('next friday', '2024-06-21'));
  it('parses "last monday"', () => expectDate('last monday', '2024-06-10'));
  it('parses "last friday"', () => expectDate('last friday', '2024-06-14'));

  // Full dates with month names
  it('parses "15 jan 2025"', () => expectDate('15 jan 2025', '2025-01-15'));
  it('parses "15th january 2025"', () => expectDate('15th january 2025', '2025-01-15'));
  it('parses "jan 15 2025"', () => expectDate('jan 15 2025', '2025-01-15'));
  it('parses "jan 15, 2025"', () => expectDate('jan 15, 2025', '2025-01-15'));
  it('parses "january 1st, 2025"', () => expectDate('january 1st, 2025', '2025-01-01'));
  it('parses "15 jan \'25"', () => expectDate("15 jan '25", '2025-01-15'));

  // Quarter references
  it('parses "Q1" (Q1 is past → 2025)', () => expectDate('Q1', '2025-01-01'));
  it('parses "Q2 2025"', () => expectDate('Q2 2025', '2025-04-01'));
  it('parses "Q3/2025"', () => expectDate('Q3/2025', '2025-07-01'));
  it('parses "1Q25"', () => expectDate('1Q25', '2025-01-01'));
  it('parses "4Q2025"', () => expectDate('4Q2025', '2025-10-01'));

  // Month + year
  it('parses "jan 2027"', () => expectDate('jan 2027', '2027-01-01'));
  it('parses "january 2027"', () => expectDate('january 2027', '2027-01-01'));
  it('parses "2027 jan"', () => expectDate('2027 jan', '2027-01-01'));
  it('parses "jan \'27"', () => expectDate("jan '27", '2027-01-01'));
  it('parses "2027-01" (ISO month)', () => expectDate('2027-01', '2027-01-01'));
  it('parses "01/2027" (slash month)', () => expectDate('01/2027', '2027-01-01'));

  // Weekday names
  it('parses "mon" (Saturday → next Monday)', () => expectDate('mon', '2024-06-17'));
  it('parses "tuesday"', () => expectDate('tuesday', '2024-06-18'));

  // Partial dates (day + month)
  it('parses "15 jan" (future)', () => expectDate('15 jan', '2025-01-15'));
  it('parses "jan 15" (future)', () => expectDate('jan 15', '2025-01-15'));
  it('parses "15th december" (future this year)', () => expectDate('15th december', '2024-12-15'));
  it('parses "1 jul" (future this year)', () => expectDate('1 jul', '2024-07-01'));

  // Ordinal day — nearest future occurrence
  it('parses "15th" as today (June 15)', () => expectDate('15th', '2024-06-15'));
  it('parses "the 1st" as next month (July 1, since June 1 is past)', () =>
    expectDate('the 1st', '2024-07-01'));
  it('parses "22nd" as June 22 (still future)', () => expectDate('22nd', '2024-06-22'));

  // Direct numeric dates
  it('parses "15/03/2024"', () => expectDate('15/03/2024', '2024-03-15'));
  it('parses "15.03.2024"', () => expectDate('15.03.2024', '2024-03-15'));

  // Month name only
  it('parses "jan" → next January', () => expectDate('jan', '2025-01-01'));
  it('parses "december" → this year', () => expectDate('december', '2024-12-01'));

  // ISO date
  it('parses "2024-06-01"', () => expectDate('2024-06-01', '2024-06-01'));

  // Duration shorthand (unsigned, always forward)
  it('parses "3w"', () => expectDate('3w', '2024-07-06'));
  it('parses "1d"', () => expectDate('1d', '2024-06-16'));
  it('parses "1m"', () => expectDate('1m', '2024-07-15'));
  it('parses "1y"', () => expectDate('1y', '2025-06-15'));
  it('parses "2w"', () => expectDate('2w', '2024-06-29'));

  // Full dates with 2-digit year
  it('parses "15 jan 27"', () => expectDate('15 jan 27', '2027-01-15'));
  it('parses "jan 15 27"', () => expectDate('jan 15 27', '2027-01-15'));

  // Numeric dates with spaces (DD MM YY)
  it('parses "15 06 27"', () => expectDate('15 06 27', '2027-06-15'));
  it('parses "15 06 2027"', () => expectDate('15 06 2027', '2027-06-15'));
  it('parses "1 1 25"', () => expectDate('1 1 25', '2025-01-01'));

  // Business time snapping
  it('calls getNextBusinessTime when provided', () => {
    const p = createDateTimeParser({
      today,
      timeZone: TIME_ZONE,
      getNextBusinessTime: date => date.add({ hours: 9 }),
    });

    const result = p('2024-01-20');
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.hour).toBe(9);
    }
  });

  // ── Standalone time ──────────────────────────────────────────────────

  it('parses "13:00" as today at 13:00', () => {
    const result = parse('13:00');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.toPlainDate().toString()).toBe('2024-06-15');
      expect(result.value.hour).toBe(13);
      expect(result.value.minute).toBe(0);
    }
  });

  it('parses "9:30:45" as today at 9:30:45', () => {
    const result = parse('9:30:45');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.hour).toBe(9);
      expect(result.value.minute).toBe(30);
      expect(result.value.second).toBe(45);
    }
  });

  it('parses "9:30:45.123" with milliseconds', () => {
    const result = parse('9:30:45.123');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.hour).toBe(9);
      expect(result.value.minute).toBe(30);
      expect(result.value.second).toBe(45);
      expect(result.value.millisecond).toBe(123);
    }
  });

  it('parses "9am" as today at 9:00', () => {
    const result = parse('9am');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.hour).toBe(9);
      expect(result.value.minute).toBe(0);
    }
  });

  it('parses "2pm" as today at 14:00', () => {
    const result = parse('2pm');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.hour).toBe(14);
    }
  });

  it('parses "12am" as today at 0:00', () => {
    const result = parse('12am');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.hour).toBe(0);
    }
  });

  it('parses "12pm" as today at 12:00', () => {
    const result = parse('12pm');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.hour).toBe(12);
    }
  });

  it('parses "5:30pm" as today at 17:30', () => {
    const result = parse('5:30pm');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.hour).toBe(17);
      expect(result.value.minute).toBe(30);
    }
  });

  // ── Date + time suffix ────────────────────────────────────────────────

  it('parses "tom 13:00" as tomorrow at 13:00', () => {
    const result = parse('tom 13:00');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.toPlainDate().toString()).toBe('2024-06-16');
      expect(result.value.hour).toBe(13);
      expect(result.value.minute).toBe(0);
    }
  });

  it('parses "mon 9:30" as next Monday at 9:30', () => {
    const result = parse('mon 9:30');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.toPlainDate().toString()).toBe('2024-06-17');
      expect(result.value.hour).toBe(9);
      expect(result.value.minute).toBe(30);
    }
  });

  it('parses "15 jan 2025 14:30:00" with full time', () => {
    const result = parse('15 jan 2025 14:30:00');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.toPlainDate().toString()).toBe('2025-01-15');
      expect(result.value.hour).toBe(14);
      expect(result.value.minute).toBe(30);
      expect(result.value.second).toBe(0);
    }
  });

  it('parses "tomorrow 9am"', () => {
    const result = parse('tomorrow 9am');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.toPlainDate().toString()).toBe('2024-06-16');
      expect(result.value.hour).toBe(9);
    }
  });

  it('parses "+3d 8:00"', () => {
    const result = parse('+3d 8:00');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.toPlainDate().toString()).toBe('2024-06-18');
      expect(result.value.hour).toBe(8);
    }
  });

  it('parses "2025-01-15 9:30:45.123" with milliseconds', () => {
    const result = parse('2025-01-15 9:30:45.123');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value.toPlainDate().toString()).toBe('2025-01-15');
      expect(result.value.hour).toBe(9);
      expect(result.value.minute).toBe(30);
      expect(result.value.second).toBe(45);
      expect(result.value.millisecond).toBe(123);
    }
  });

  // Failures
  it('returns failure for empty input', () => {
    expect(parse('').success).toBe(false);
  });

  it('returns failure for unparseable input', () => {
    expect(parse('gibberish').success).toBe(false);
  });
});

// ── parseStandaloneTime ──────────────────────────────────────────────

describe('parseStandaloneTime', () => {
  it('parses "13:00"', () => {
    const t = parseStandaloneTime('13:00');
    expect(t?.hour).toBe(13);
    expect(t?.minute).toBe(0);
  });

  it('parses "9:30:45"', () => {
    const t = parseStandaloneTime('9:30:45');
    expect(t?.hour).toBe(9);
    expect(t?.minute).toBe(30);
    expect(t?.second).toBe(45);
  });

  it('parses "0:00:00.500"', () => {
    const t = parseStandaloneTime('0:00:00.500');
    expect(t?.hour).toBe(0);
    expect(t?.millisecond).toBe(500);
  });

  it('parses "9am"', () => {
    const t = parseStandaloneTime('9am');
    expect(t?.hour).toBe(9);
    expect(t?.minute).toBe(0);
  });

  it('parses "12pm"', () => {
    expect(parseStandaloneTime('12pm')?.hour).toBe(12);
  });

  it('parses "12am"', () => {
    expect(parseStandaloneTime('12am')?.hour).toBe(0);
  });

  it('parses "5:30pm"', () => {
    const t = parseStandaloneTime('5:30pm');
    expect(t?.hour).toBe(17);
    expect(t?.minute).toBe(30);
  });

  it('normalizes "9:30:45.1" to 100ms', () => {
    const t = parseStandaloneTime('9:30:45.1');
    expect(t?.millisecond).toBe(100);
  });

  it('returns undefined for invalid time "25:00"', () => {
    expect(parseStandaloneTime('25:00')).toBeUndefined();
  });

  it('returns undefined for non-time input', () => {
    expect(parseStandaloneTime('hello')).toBeUndefined();
  });
});
