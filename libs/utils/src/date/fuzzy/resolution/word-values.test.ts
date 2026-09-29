import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';
import { describe, expect, it } from 'vitest';

import { tokenize } from '../lexer/tokenize';
import { slotsStatedBy } from '../scoring/stated-slots';
import type { SlotValues } from '../slot';
import { ALL_SLOTS, ESlot } from '../slot';
import { valuesStatedBy } from './word-values';

const now = Temporal.ZonedDateTime.from('2024-06-15T14:30:45.500[UTC]');

function values(input: string): SlotValues {
  const [token] = tokenize(input);
  return valuesStatedBy(token, now) ?? {};
}

function date(input: string): string {
  const stated = values(input);
  return `${stated[ESlot.Year]}-${stated[ESlot.Month]}-${stated[ESlot.Day]}`;
}

describe('valuesStatedBy', () => {
  it.each([
    ['today', '2024-6-15'],
    ['tomorrow', '2024-6-16'],
    ['yesterday', '2024-6-14'],
    ['mon', '2024-6-17'],
    ['sat', '2024-6-22'],
    ['next fri', '2024-6-21'],
    ['last fri', '2024-6-14'],
    ['this sat', '2024-6-15'],
    ['this fri', '2024-6-21'],
    ['eow', '2024-6-16'],
    ['weekend', '2024-6-15'],
    ['next weekend', '2024-6-22'],
    ['end of next month', '2024-7-31'],
    ['eom', '2024-6-30'],
  ])('reads "%s" as the date %s', (input, expected) => {
    expect(date(input)).toBe(expected);
  });

  it('reads "now" as this very moment', () => {
    expect(values('now')).toEqual({
      [ESlot.Year]: 2024,
      [ESlot.Month]: 6,
      [ESlot.Day]: 15,
      [ESlot.Hour]: 14,
      [ESlot.Minute]: 30,
      [ESlot.Second]: 45,
      [ESlot.Millisecond]: 500,
    });
  });

  it('reads the end of the day as its last moment', () => {
    expect(values('eod')).toEqual({
      [ESlot.Year]: 2024,
      [ESlot.Month]: 6,
      [ESlot.Day]: 15,
      [ESlot.Hour]: 23,
      [ESlot.Minute]: 59,
      [ESlot.Second]: 59,
      [ESlot.Millisecond]: 999,
    });
  });

  it('reads a quarter as the first day of its first month', () => {
    expect(values('Q3')).toEqual({ [ESlot.Month]: 7, [ESlot.Day]: 1 });
  });

  it('reads a time keyword as a full time', () => {
    expect(values('noon')).toEqual({
      [ESlot.Hour]: 12,
      [ESlot.Minute]: 0,
      [ESlot.Second]: 0,
      [ESlot.Millisecond]: 0,
    });
  });

  it.each([
    'today',
    'now',
    'mon',
    'next fri',
    'eom',
    'eod',
    'bow',
    'end of next month',
    'this fri',
    'utc',
    'weekend',
    'morning',
    '+3d',
    '-4h',
    'Q1',
    'jan',
    '15th',
    "'27",
    'noon',
    '13:00',
    '9:30:45',
    '9:30:45.123',
    '15',
    'pm',
    'next',
    'days',
    'gibberish',
  ])('gives "%s" a value for every slot scoring closes for it, and for no other', input => {
    const [token] = tokenize(input);
    const stated = values(input);

    expect(ALL_SLOTS.filter(slot => !isNil(stated[slot]))).toEqual(
      ALL_SLOTS.filter(slot => slotsStatedBy(token).includes(slot))
    );
  });
});
