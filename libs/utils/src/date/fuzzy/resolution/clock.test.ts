import { describe, expect, it } from 'vitest';

import { EMeridiem } from '../lexer/token';
import type { SlotValues } from '../slot';
import { ESlot } from '../slot';
import { timeOfDay } from './clock';

function time(values: SlotValues, ...meridiems: readonly EMeridiem[]): string | undefined {
  return timeOfDay(values, { told: meridiems })?.toString();
}

describe('timeOfDay', () => {
  it('is midnight when no time is told', () => {
    expect(time({ [ESlot.Year]: 2025, [ESlot.Month]: 1, [ESlot.Day]: 15 })).toBe('00:00:00');
  });

  it('fills the parts left untold with zeroes', () => {
    expect(time({ [ESlot.Hour]: 10 })).toBe('10:00:00');
    expect(time({ [ESlot.Hour]: 14, [ESlot.Minute]: 30 })).toBe('14:30:00');
  });

  it('keeps every part that is told', () => {
    expect(
      time({
        [ESlot.Hour]: 23,
        [ESlot.Minute]: 59,
        [ESlot.Second]: 59,
        [ESlot.Millisecond]: 999,
      })
    ).toBe('23:59:59.999');
  });

  it.each<[string, SlotValues]>([
    ['hour 24', { [ESlot.Hour]: 24 }],
    ['minute 60', { [ESlot.Hour]: 12, [ESlot.Minute]: 60 }],
    ['second 60', { [ESlot.Hour]: 12, [ESlot.Minute]: 0, [ESlot.Second]: 60 }],
    [
      'millisecond 1000',
      { [ESlot.Hour]: 12, [ESlot.Minute]: 0, [ESlot.Second]: 0, [ESlot.Millisecond]: 1000 },
    ],
  ])('is no time with %s', (_name, values) => {
    expect(time(values)).toBeUndefined();
  });

  it.each<[string, SlotValues]>([
    ['minutes without an hour', { [ESlot.Minute]: 30 }],
    ['seconds without minutes', { [ESlot.Hour]: 10, [ESlot.Second]: 45 }],
    [
      'milliseconds without seconds',
      { [ESlot.Hour]: 10, [ESlot.Minute]: 30, [ESlot.Millisecond]: 5 },
    ],
  ])('is no time with %s', (_name, values) => {
    expect(time(values)).toBeUndefined();
  });

  describe('a half of the day that is only implied', () => {
    function impliedTime(hour: number, implied: EMeridiem): string | undefined {
      return timeOfDay({ [ESlot.Hour]: hour }, { told: [], implied })?.toString();
    }

    it.each([
      [8, EMeridiem.Pm, '20:00:00'],
      [12, EMeridiem.Pm, '12:00:00'],
      [9, EMeridiem.Am, '09:00:00'],
      [12, EMeridiem.Am, '00:00:00'],
    ])('applies to hour %d of the dial', (hour, implied, expected) => {
      expect(impliedTime(hour, implied)).toBe(expected);
    });

    it.each([0, 13, 21])('leaves hour %d, which says its own half, as it is', hour => {
      expect(impliedTime(hour, EMeridiem.Pm)).toBe(
        timeOfDay({ [ESlot.Hour]: hour }, { told: [] })?.toString()
      );
    });

    it('gives way to the half that is told', () => {
      expect(
        timeOfDay({ [ESlot.Hour]: 9 }, { told: [EMeridiem.Am], implied: EMeridiem.Pm })?.toString()
      ).toBe('09:00:00');
    });

    it('is no time on its own', () => {
      expect(timeOfDay({}, { told: [], implied: EMeridiem.Pm })?.toString()).toBe('00:00:00');
    });
  });

  describe('am and pm', () => {
    it.each([
      [12, EMeridiem.Am, '00:00:00'],
      [1, EMeridiem.Am, '01:00:00'],
      [11, EMeridiem.Am, '11:00:00'],
      [12, EMeridiem.Pm, '12:00:00'],
      [1, EMeridiem.Pm, '13:00:00'],
      [11, EMeridiem.Pm, '23:00:00'],
    ])('reads %d %s as %s', (hour, meridiem, expected) => {
      expect(time({ [ESlot.Hour]: hour }, meridiem)).toBe(expected);
    });

    it.each([0, 13])('does not apply to hour %d', hour => {
      expect(time({ [ESlot.Hour]: hour }, EMeridiem.Pm)).toBeUndefined();
    });

    it('needs an hour to apply to', () => {
      expect(time({ [ESlot.Day]: 15 }, EMeridiem.Pm)).toBeUndefined();
    });

    it('cannot be told twice', () => {
      expect(time({ [ESlot.Hour]: 9 }, EMeridiem.Am, EMeridiem.Pm)).toBeUndefined();
    });
  });
});
