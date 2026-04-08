import { Temporal } from '@js-temporal/polyfill';
import { describe, expect, it } from 'vitest';
import { ensureFuture } from './ensure-future';
import { EParseTemporality } from './types';

describe('ensureFuture', () => {
  const now = Temporal.ZonedDateTime.from('2024-06-15T14:00:00[UTC]');

  describe('TimeOnly', () => {
    it('advances past time by 1 day', () => {
      const value = Temporal.ZonedDateTime.from('2024-06-15T13:00:00[UTC]');
      const result = ensureFuture(value, now, EParseTemporality.TimeOnly);
      expect(result.toString()).toBe(
        Temporal.ZonedDateTime.from('2024-06-16T13:00:00[UTC]').toString()
      );
    });

    it('keeps future time unchanged', () => {
      const value = Temporal.ZonedDateTime.from('2024-06-15T15:00:00[UTC]');
      const result = ensureFuture(value, now, EParseTemporality.TimeOnly);
      expect(result.toString()).toBe(value.toString());
    });
  });

  describe('Weekday', () => {
    it('advances past weekday+time by 7 days', () => {
      const value = Temporal.ZonedDateTime.from('2024-06-15T10:00:00[UTC]');
      const result = ensureFuture(value, now, EParseTemporality.Weekday);
      expect(result.toString()).toBe(
        Temporal.ZonedDateTime.from('2024-06-22T10:00:00[UTC]').toString()
      );
    });

    it('keeps future weekday unchanged', () => {
      const value = Temporal.ZonedDateTime.from('2024-06-17T09:00:00[UTC]');
      const result = ensureFuture(value, now, EParseTemporality.Weekday);
      expect(result.toString()).toBe(value.toString());
    });
  });

  describe('DayOfMonth', () => {
    it('advances past day-of-month by 1 month', () => {
      const value = Temporal.ZonedDateTime.from('2024-06-15T00:00:00[UTC]');
      const result = ensureFuture(value, now, EParseTemporality.DayOfMonth);
      expect(result.toString()).toBe(
        Temporal.ZonedDateTime.from('2024-07-15T00:00:00[UTC]').toString()
      );
    });

    it('keeps future day-of-month unchanged', () => {
      const value = Temporal.ZonedDateTime.from('2024-06-22T00:00:00[UTC]');
      const result = ensureFuture(value, now, EParseTemporality.DayOfMonth);
      expect(result.toString()).toBe(value.toString());
    });
  });

  describe('MonthDay', () => {
    it('advances past month+day by 1 year', () => {
      const value = Temporal.ZonedDateTime.from('2024-06-14T00:00:00[UTC]');
      const result = ensureFuture(value, now, EParseTemporality.MonthDay);
      expect(result.toString()).toBe(
        Temporal.ZonedDateTime.from('2025-06-14T00:00:00[UTC]').toString()
      );
    });

    it('keeps future month+day unchanged', () => {
      const value = Temporal.ZonedDateTime.from('2025-01-15T00:00:00[UTC]');
      const result = ensureFuture(value, now, EParseTemporality.MonthDay);
      expect(result.toString()).toBe(value.toString());
    });
  });

  describe('PastDirected', () => {
    it('does not advance past-directed results', () => {
      const value = Temporal.ZonedDateTime.from('2024-06-14T00:00:00[UTC]');
      const result = ensureFuture(value, now, EParseTemporality.PastDirected);
      expect(result.toString()).toBe(value.toString());
    });
  });

  describe('ExplicitDate', () => {
    it('does not advance explicit past dates', () => {
      const value = Temporal.ZonedDateTime.from('2024-01-15T00:00:00[UTC]');
      const result = ensureFuture(value, now, EParseTemporality.ExplicitDate);
      expect(result.toString()).toBe(value.toString());
    });
  });

  describe('FutureDirected', () => {
    it('does not modify future-directed results', () => {
      const value = Temporal.ZonedDateTime.from('2024-06-16T00:00:00[UTC]');
      const result = ensureFuture(value, now, EParseTemporality.FutureDirected);
      expect(result.toString()).toBe(value.toString());
    });
  });

  describe('Boundary', () => {
    it('does not advance boundary results', () => {
      const value = Temporal.ZonedDateTime.from('2024-06-01T00:00:00[UTC]');
      const result = ensureFuture(value, now, EParseTemporality.Boundary);
      expect(result.toString()).toBe(value.toString());
    });
  });

  describe('KeywordTime', () => {
    it('advances noon past 12:00 by 1 day', () => {
      const value = Temporal.ZonedDateTime.from('2024-06-15T12:00:00[UTC]');
      const result = ensureFuture(value, now, EParseTemporality.KeywordTime);
      expect(result.toString()).toBe(
        Temporal.ZonedDateTime.from('2024-06-16T12:00:00[UTC]').toString()
      );
    });
  });

  describe('MonthOnly', () => {
    it('advances past month by 1 year', () => {
      const value = Temporal.ZonedDateTime.from('2024-05-01T00:00:00[UTC]');
      const result = ensureFuture(value, now, EParseTemporality.MonthOnly);
      expect(result.toString()).toBe(
        Temporal.ZonedDateTime.from('2025-05-01T00:00:00[UTC]').toString()
      );
    });
  });

  describe('Quarter', () => {
    it('advances past quarter by 1 year', () => {
      const value = Temporal.ZonedDateTime.from('2024-01-01T00:00:00[UTC]');
      const result = ensureFuture(value, now, EParseTemporality.Quarter);
      expect(result.toString()).toBe(
        Temporal.ZonedDateTime.from('2025-01-01T00:00:00[UTC]').toString()
      );
    });
  });
});
