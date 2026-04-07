import { Temporal } from '@js-temporal/polyfill';
import { describe, expect, it } from 'vitest';

import { stepDateTime } from './stepDateTime';
import { EDateTimeStep } from './types';

const TIME_ZONE = 'UTC';

function makeZDT(date: string): Temporal.ZonedDateTime {
  return Temporal.PlainDate.from(date).toZonedDateTime(TIME_ZONE);
}

describe('stepDateTime', () => {
  const base = makeZDT('2024-01-15');

  it('steps forward by day', () => {
    const result = stepDateTime(base, EDateTimeStep.Day, 1);
    expect(result.toPlainDate().toString()).toBe('2024-01-16');
  });

  it('steps backward by day', () => {
    const result = stepDateTime(base, EDateTimeStep.Day, -1);
    expect(result.toPlainDate().toString()).toBe('2024-01-14');
  });

  it('steps forward by week', () => {
    const result = stepDateTime(base, EDateTimeStep.Week, 1);
    expect(result.toPlainDate().toString()).toBe('2024-01-22');
  });

  it('steps backward by week', () => {
    const result = stepDateTime(base, EDateTimeStep.Week, -1);
    expect(result.toPlainDate().toString()).toBe('2024-01-08');
  });

  it('steps forward by hour', () => {
    const result = stepDateTime(base, EDateTimeStep.Hour, 1);
    expect(result.hour).toBe(1);
    expect(result.toPlainDate().toString()).toBe('2024-01-15');
  });

  it('steps forward by minute', () => {
    const result = stepDateTime(base, EDateTimeStep.Minute, 1);
    expect(result.minute).toBe(1);
    expect(result.toPlainDate().toString()).toBe('2024-01-15');
  });

  it('handles month boundary', () => {
    const endOfMonth = makeZDT('2024-01-31');
    const result = stepDateTime(endOfMonth, EDateTimeStep.Day, 1);
    expect(result.toPlainDate().toString()).toBe('2024-02-01');
  });

  it('handles year boundary', () => {
    const endOfYear = makeZDT('2024-12-31');
    const result = stepDateTime(endOfYear, EDateTimeStep.Day, 1);
    expect(result.toPlainDate().toString()).toBe('2025-01-01');
  });
});
