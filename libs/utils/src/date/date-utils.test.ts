import { Temporal } from '@js-temporal/polyfill';
import { describe, expect, it } from 'vitest';
import {
  applyOffset,
  parseDirectDate,
  parseStandaloneTime,
  resolveKeyword,
  resolveMonthName,
  resolveMonthYear,
  resolveNextWeekday,
  resolvePreviousWeekday,
  resolveQuarter,
} from './date-utils';

const TIME_ZONE = 'UTC';

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

describe('parseStandaloneTime', () => {
  it('parses "13:00"', () => {
    const result = parseStandaloneTime('13:00');
    expect(result?.hour).toBe(13);
    expect(result?.minute).toBe(0);
  });

  it('parses "9am"', () => {
    const result = parseStandaloneTime('9am');
    expect(result?.hour).toBe(9);
  });

  it('returns undefined for non-time input', () => {
    expect(parseStandaloneTime('hello')).toBeUndefined();
  });
});
