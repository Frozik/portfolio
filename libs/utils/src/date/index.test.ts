import { Temporal } from '@js-temporal/polyfill';

import { getEndOfMonth, getStartOfMonth, getStartOfWeek } from './index';

describe('getStartOfMonth', () => {
  test.each([
    { source: '2022-01', expected: '2022-01-01' },
    { source: '2024-02', expected: '2024-02-01' },
  ])(`$source => $expected`, ({ source, expected }) => {
    const yearMonth = Temporal.PlainYearMonth.from(source);
    const result = getStartOfMonth(yearMonth);
    expect(result.toString()).toBe(expected);
  });
});

describe('getEndOfMonth', () => {
  test.each([
    { source: '2022-01', expected: '2022-01-31' },
    { source: '2023-02', expected: '2023-02-28' },
    { source: '2024-02', expected: '2024-02-29' },
    { source: '2024-04', expected: '2024-04-30' },
  ])(`$source => $expected`, ({ source, expected }) => {
    const yearMonth = Temporal.PlainYearMonth.from(source);
    const result = getEndOfMonth(yearMonth);
    expect(result.toString()).toBe(expected);
  });
});

describe('getStartOfWeek', () => {
  test.each([
    { source: '2022-01-01', expected: '2021-12-27' },
    { source: '2024-02-01', expected: '2024-01-29' },
    { source: '2022-01-31', expected: '2022-01-31' },
    { source: '2023-02-28', expected: '2023-02-27' },
    { source: '2024-02-29', expected: '2024-02-26' },
    { source: '2024-04-30', expected: '2024-04-29' },
    { source: '2024-09-23', expected: '2024-09-23' },
    { source: '2024-09-24', expected: '2024-09-23' },
    { source: '2024-09-25', expected: '2024-09-23' },
    { source: '2024-09-26', expected: '2024-09-23' },
    { source: '2024-09-27', expected: '2024-09-23' },
    { source: '2024-09-28', expected: '2024-09-23' },
    { source: '2024-09-29', expected: '2024-09-23' },
  ])(`$source => $expected`, ({ source, expected }) => {
    const result = getStartOfWeek(Temporal.PlainDate.from(source));
    expect(result.toString()).toBe(expected);
  });
});
