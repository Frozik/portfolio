import { describe, expect, it } from 'vitest';

import { ALL_SLOTS, ESlot } from '../slot';
import { plausibilityOf } from './plausibility';
import { CERTAIN, IMPOSSIBLE, VERY_LIKELY } from './weights';

function possibleSlots(value: number): readonly ESlot[] {
  const weights = plausibilityOf(value);
  return ALL_SLOTS.filter(slot => weights[slot] > IMPOSSIBLE);
}

describe('plausibilityOf', () => {
  it('takes a number of four digits for a year and nothing else', () => {
    expect(possibleSlots(2025)).toEqual([ESlot.Year]);
    expect(plausibilityOf(2025)[ESlot.Year]).toBe(CERTAIN);
  });

  it('takes a number of three digits for milliseconds and nothing else', () => {
    expect(possibleSlots(123)).toEqual([ESlot.Millisecond]);
    expect(plausibilityOf(123)[ESlot.Millisecond]).toBe(CERTAIN);
  });

  it('takes a number past the last minute for a two-digit year', () => {
    expect(possibleSlots(82)).toEqual([ESlot.Year]);
    expect(plausibilityOf(82)[ESlot.Year]).toBe(VERY_LIKELY);
  });

  it('never takes a number past the last day for a day, a month or an hour', () => {
    expect(possibleSlots(45)).toEqual([ESlot.Year, ESlot.Minute, ESlot.Second]);
  });

  it('never takes a number past the last hour for an hour or a month', () => {
    expect(possibleSlots(27)).toEqual([ESlot.Year, ESlot.Day, ESlot.Minute, ESlot.Second]);
  });

  it('prefers the hour to the day for a number past the last month', () => {
    const weights = plausibilityOf(14);

    expect(weights[ESlot.Month]).toBe(IMPOSSIBLE);
    expect(weights[ESlot.Hour]).toBeGreaterThan(weights[ESlot.Day]);
  });

  it('lets a number up to twelve be any part of the date and of the time but milliseconds', () => {
    expect(possibleSlots(7)).toEqual([
      ESlot.Year,
      ESlot.Month,
      ESlot.Day,
      ESlot.Hour,
      ESlot.Minute,
      ESlot.Second,
    ]);
  });

  it('takes zero for the year 2000 or a part of the time, but never for a month or a day', () => {
    expect(possibleSlots(0)).toEqual([ESlot.Year, ESlot.Hour, ESlot.Minute, ESlot.Second]);
  });

  it('takes no number of fewer than three digits for milliseconds', () => {
    expect(possibleSlots(0)).not.toContain(ESlot.Millisecond);
    expect(possibleSlots(99)).not.toContain(ESlot.Millisecond);
  });
});
