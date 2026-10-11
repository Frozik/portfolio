import { Temporal } from 'temporal-polyfill';

import {
  formatMonthYear,
  normalizeMonthYearInput,
  parseMonthYear,
  readMonthYearText,
} from './month-year-input';

const atEnd = (text: string) =>
  normalizeMonthYearInput(text, { start: text.length, end: text.length });

describe('month and year input', () => {
  it('keeps digits, inserts the slash and stops at four digits', () => {
    expect(atEnd('12')).toEqual({ value: '12', selection: { start: 2, end: 2 } });
    expect(atEnd('123')).toEqual({ value: '12/3', selection: { start: 4, end: 4 } });
    expect(atEnd('12-29-39')).toEqual({ value: '12/29', selection: { start: 5, end: 5 } });
    expect(atEnd('1')?.value).toBe('1');
  });

  it('reads a first digit no month starts with as the month itself', () => {
    expect(atEnd('5')).toEqual({ value: '05', selection: { start: 2, end: 2 } });
    expect(atEnd('529')?.value).toBe('05/29');
  });

  it('parses a whole MM/YY into this century and rejects a month past twelve', () => {
    expect(parseMonthYear('12/29')).toEqual({
      kind: 'value',
      value: Temporal.PlainYearMonth.from({ year: 2029, month: 12 }),
    });
    expect(parseMonthYear('13/29')).toEqual({ kind: 'invalid' });
    expect(parseMonthYear('00/29')).toEqual({ kind: 'invalid' });
    expect(parseMonthYear('12/')).toEqual({ kind: 'incomplete' });
    expect(parseMonthYear('')).toEqual({ kind: 'empty' });
  });

  it('prints a value the way it is typed', () => {
    expect(formatMonthYear(Temporal.PlainYearMonth.from({ year: 2031, month: 3 }))).toBe('03/31');
    expect(formatMonthYear(undefined)).toBe('');
  });

  it('reads a pasted four-digit year and an ISO year-month as the month they name', () => {
    expect(atEnd('12/2029')?.value).toBe('12/29');
    expect(atEnd('2029-12')?.value).toBe('12/29');
    expect(atEnd('3 / 2031')?.value).toBe('03/31');
  });

  it('reads whole text as a month only when it is one, never by cutting digits off', () => {
    expect(readMonthYearText('12/2029')).toEqual({
      kind: 'value',
      value: Temporal.PlainYearMonth.from({ year: 2029, month: 12 }),
    });
    expect(readMonthYearText('2029-12')).toMatchObject({ kind: 'value' });
    expect(readMonthYearText('12/20299')).toEqual({ kind: 'invalid' });
    expect(readMonthYearText('1229')).toMatchObject({ kind: 'value' });
  });
});
