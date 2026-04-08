import { Temporal } from '@js-temporal/polyfill';
import { describe, expect, it } from 'vitest';
import type { ISlotContext } from './tokenParser';
import {
  applyContextRules,
  detectConflicts,
  ETokenKind,
  parseTokenBased,
  resolveSlots,
  tagCandidates,
  tokenize,
} from './tokenParser';

const TIME_ZONE = 'UTC';

function makeContext(overrides: Partial<ISlotContext> = {}): ISlotContext {
  return {
    hasDateKeyword: false,
    hasBoundaryKeyword: false,
    hasMonthName: false,
    hasTimeKeyword: false,
    hasColonTime: false,
    hasOrdinal: false,
    hasAmPm: false,
    ...overrides,
  };
}

describe('tokenize', () => {
  it('classifies month names', () => {
    const tokens = tokenize('jan');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe(ETokenKind.MonthName);
    expect(tokens[0].value).toBe(1);
  });

  it('classifies bare numbers', () => {
    const tokens = tokenize('10 20');
    expect(tokens).toHaveLength(2);
    expect(tokens[0].kind).toBe(ETokenKind.Number);
    expect(tokens[0].value).toBe(10);
    expect(tokens[1].value).toBe(20);
  });

  it('classifies colon time', () => {
    const tokens = tokenize('13:00');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe(ETokenKind.ColonTime);
    expect(tokens[0].extra).toBe('13:0:0.0');
  });

  it('classifies colon time with seconds and ms', () => {
    const tokens = tokenize('9:30:45.123');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].extra).toBe('9:30:45.123');
  });

  it('splits "9am" into colon time token', () => {
    const tokens = tokenize('9am');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe(ETokenKind.ColonTime);
    expect(tokens[0].extra).toBe('9:0:0.0');
  });

  it('splits "5:30pm" into colon time token', () => {
    const tokens = tokenize('5:30pm');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].extra).toBe('17:30:0.0');
  });

  it('classifies ordinals', () => {
    const tokens = tokenize('15th');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe(ETokenKind.Ordinal);
    expect(tokens[0].value).toBe(15);
  });

  it('classifies date keywords', () => {
    const tokens = tokenize('tomorrow');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe(ETokenKind.Keyword);
  });

  it('classifies time keywords', () => {
    const tokens = tokenize('noon');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe(ETokenKind.TimeKeyword);
  });

  it('classifies boundary keywords', () => {
    const tokens = tokenize('eom');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe(ETokenKind.BoundaryKeyword);
  });

  it('classifies apostrophe year', () => {
    const tokens = tokenize("'27");
    expect(tokens).toHaveLength(1);
    expect(tokens[0].value).toBe(2027);
  });

  it('classifies offset tokens', () => {
    const tokens = tokenize('+3d');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe(ETokenKind.Offset);
    expect(tokens[0].value).toBe(3);
    expect(tokens[0].extra).toBe('d');
  });

  it('classifies duration tokens', () => {
    const tokens = tokenize('1w');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe(ETokenKind.Duration);
    expect(tokens[0].value).toBe(1);
    expect(tokens[0].extra).toBe('w');
  });

  it('classifies unknown tokens', () => {
    const tokens = tokenize('gibberish');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe(ETokenKind.Unknown);
  });

  it('handles comma-separated input', () => {
    const tokens = tokenize('10, nov, 2025');
    expect(tokens).toHaveLength(3);
    expect(tokens[0].value).toBe(10);
    expect(tokens[1].value).toBe(11);
    expect(tokens[2].value).toBe(2025);
  });

  it('classifies weekday names', () => {
    const tokens = tokenize('monday');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe(ETokenKind.WeekdayName);
    expect(tokens[0].value).toBe(1);
  });

  it('classifies quarter tokens', () => {
    const tokens = tokenize('Q1');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe(ETokenKind.Quarter);
    expect(tokens[0].value).toBe(1);
  });

  it('classifies AM/PM standalone', () => {
    const tokens = tokenize('pm');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe(ETokenKind.AmPm);
    expect(tokens[0].value).toBe(12);
  });

  it('classifies direction tokens', () => {
    const tokens = tokenize('next');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe(ETokenKind.Direction);
    expect(tokens[0].value).toBe(1);
  });

  it('classifies unit tokens', () => {
    const tokens = tokenize('days');
    expect(tokens).toHaveLength(1);
    expect(tokens[0].kind).toBe(ETokenKind.Unit);
    expect(tokens[0].extra).toBe('d');
  });
});

describe('detectConflicts', () => {
  it('detects two date keywords', () => {
    const tokens = tokenize('tom yesterday');
    expect(detectConflicts(tokens)).toBeDefined();
  });

  it('detects date keyword + duration', () => {
    const tokens = tokenize('yesterday 1d');
    expect(detectConflicts(tokens)).toBeDefined();
  });

  it('detects date keyword + offset', () => {
    const tokens = tokenize('tom +3d');
    expect(detectConflicts(tokens)).toBeDefined();
  });

  it('detects two time sources', () => {
    const tokens = tokenize('noon 13:00');
    expect(detectConflicts(tokens)).toBeDefined();
  });

  it('detects multiple month names', () => {
    const tokens = tokenize('jan feb');
    expect(detectConflicts(tokens)).toBeDefined();
  });

  it('allows date keyword + time', () => {
    const tokens = tokenize('tomorrow 13:00');
    expect(detectConflicts(tokens)).toBeUndefined();
  });

  it('allows date keyword + number (hour)', () => {
    const tokens = tokenize('tom 10');
    expect(detectConflicts(tokens)).toBeUndefined();
  });

  it('allows month + day + time numbers', () => {
    const tokens = tokenize('10 nov 10 30');
    expect(detectConflicts(tokens)).toBeUndefined();
  });
});

describe('tagCandidates', () => {
  it('creates candidates for Number and Ordinal tokens only', () => {
    const tokens = tokenize('10 nov 2025');
    const context = makeContext({ hasMonthName: true });
    const candidates = tagCandidates(tokens, context);
    expect(candidates).toHaveLength(2);
    expect(candidates[0].token.value).toBe(10);
    expect(candidates[1].token.value).toBe(2025);
  });

  it('assigns year score 1.0 for 4-digit numbers', () => {
    const tokens = tokenize('2025');
    const context = makeContext();
    const candidates = tagCandidates(tokens, context);
    expect(candidates[0].scores.year).toBe(1.0);
  });

  it('assigns ms score 1.0 for 3-digit numbers (100-999)', () => {
    const tokens = tokenize('123');
    const context = makeContext();
    const candidates = tagCandidates(tokens, context);
    expect(candidates[0].scores.ms).toBe(1.0);
  });

  it('assigns year score 0.9 for 60-99 range', () => {
    const tokens = tokenize('82');
    const context = makeContext();
    const candidates = tagCandidates(tokens, context);
    expect(candidates[0].scores.year).toBe(0.9);
  });

  it('assigns day and hour scores for 13-23 range', () => {
    const tokens = tokenize('14');
    const context = makeContext();
    const candidates = tagCandidates(tokens, context);
    expect(candidates[0].scores.day).toBe(0.5);
    expect(candidates[0].scores.hour).toBe(0.7);
  });

  it('includes Ordinal tokens as candidates', () => {
    const tokens = tokenize('15th');
    const context = makeContext();
    const candidates = tagCandidates(tokens, context);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].token.kind).toBe(ETokenKind.Ordinal);
  });
});

describe('applyContextRules', () => {
  it('zeros month for all candidates when MonthName present', () => {
    const tokens = tokenize('10 nov 2025');
    const context = makeContext({ hasMonthName: true });
    const candidates = tagCandidates(tokens, context);
    applyContextRules(candidates, tokens, context);
    for (const c of candidates) {
      expect(c.scores.month).toBe(0);
    }
  });

  it('zeros day/month/year when date keyword present', () => {
    const tokens = tokenize('10 30');
    const context = makeContext({ hasDateKeyword: true });
    const candidates = tagCandidates(tokens, context);
    applyContextRules(candidates, tokens, context);
    for (const c of candidates) {
      expect(c.scores.day).toBe(0);
      expect(c.scores.month).toBe(0);
      expect(c.scores.year).toBe(0);
    }
  });

  it('zeros hour/minute/second/ms when ColonTime present', () => {
    const tokens = tokenize('10');
    const context = makeContext({ hasColonTime: true });
    const candidates = tagCandidates(tokens, context);
    applyContextRules(candidates, tokens, context);
    expect(candidates[0].scores.hour).toBe(0);
    expect(candidates[0].scores.minute).toBe(0);
    expect(candidates[0].scores.second).toBe(0);
    expect(candidates[0].scores.ms).toBe(0);
  });

  it('zeros hour/minute/second/ms when TimeKeyword present', () => {
    const tokens = tokenize('10');
    const context = makeContext({ hasTimeKeyword: true });
    const candidates = tagCandidates(tokens, context);
    applyContextRules(candidates, tokens, context);
    expect(candidates[0].scores.hour).toBe(0);
  });

  it('boosts day for number adjacent to MonthName (after)', () => {
    const tokens = tokenize('nov 10');
    const context = makeContext({ hasMonthName: true });
    const candidates = tagCandidates(tokens, context);
    const baseDayScore = candidates[0].scores.day;
    applyContextRules(candidates, tokens, context);
    expect(candidates[0].scores.day).toBe(baseDayScore + 0.5 + 0.3);
  });

  it('boosts day for number adjacent to MonthName (before)', () => {
    const tokens = tokenize('10 nov');
    const context = makeContext({ hasMonthName: true });
    const candidates = tagCandidates(tokens, context);
    const baseDayScore = candidates[0].scores.day;
    applyContextRules(candidates, tokens, context);
    expect(candidates[0].scores.day).toBe(baseDayScore + 0.5 + 0.3);
  });

  it('applies position boost for date keyword (time order)', () => {
    const tokens = tokenize('10 30');
    const context = makeContext({ hasDateKeyword: true });
    const candidates = tagCandidates(tokens, context);
    applyContextRules(candidates, tokens, context);
    expect(candidates[0].scores.hour).toBeGreaterThan(0);
    expect(candidates[1].scores.minute).toBeGreaterThan(0);
  });

  it('applies AM/PM influence to candidate with highest hour score', () => {
    const tokens = tokenize('10');
    const context = makeContext({ hasAmPm: true });
    const candidates = tagCandidates(tokens, context);
    const hourBefore = candidates[0].scores.hour;
    applyContextRules(candidates, tokens, context);
    expect(candidates[0].scores.hour).toBe(hourBefore + 0.2);
  });

  it('zeros day for Number candidates when Ordinal present', () => {
    const tokens = tokenize('15th 10');
    const context = makeContext({ hasOrdinal: true });
    const candidates = tagCandidates(tokens, context);
    const numberCandidate = candidates.find(c => c.token.kind === ETokenKind.Number);
    applyContextRules(candidates, tokens, context);
    expect(numberCandidate?.scores.day).toBe(0);
  });
});

describe('resolveSlots', () => {
  it('assigns 4-digit number to year (certain assignment)', () => {
    const tokens = tokenize('2025');
    const context = makeContext();
    const candidates = tagCandidates(tokens, context);
    applyContextRules(candidates, tokens, context);
    const result = resolveSlots(candidates);
    expect(result).toBeDefined();
    expect(result?.get(candidates[0])).toBe('year');
  });

  it('assigns 3-digit number to ms (certain assignment)', () => {
    const tokens = tokenize('123');
    const context = makeContext();
    const candidates = tagCandidates(tokens, context);
    applyContextRules(candidates, tokens, context);
    const result = resolveSlots(candidates);
    expect(result).toBeDefined();
    expect(result?.get(candidates[0])).toBe('ms');
  });

  it('assigns multiple numbers via greedy resolution', () => {
    const tokens = tokenize('15 3 2025');
    const context = makeContext();
    const candidates = tagCandidates(tokens, context);
    applyContextRules(candidates, tokens, context);
    const result = resolveSlots(candidates);
    expect(result).toBeDefined();
    expect(result?.get(candidates[0])).toBe('day');
    expect(result?.get(candidates[1])).toBe('month');
    expect(result?.get(candidates[2])).toBe('year');
  });

  it('returns defined for empty candidates', () => {
    const result = resolveSlots([]);
    expect(result).toBeDefined();
    expect(result?.size).toBe(0);
  });
});

describe('parseTokenBased', () => {
  const today = Temporal.PlainDate.from('2025-03-15');

  it('parses "10 nov 10 30" as 10 Nov at 10:30', () => {
    const result = parseTokenBased('10 nov 10 30', today, TIME_ZONE);
    expect(result).toBeDefined();
    expect(result?.toPlainDate().month).toBe(11);
    expect(result?.toPlainDate().day).toBe(10);
    expect(result?.hour).toBe(10);
    expect(result?.minute).toBe(30);
  });

  it('parses "tomorrow noon" as tomorrow 12:00', () => {
    const result = parseTokenBased('tomorrow noon', today, TIME_ZONE);
    expect(result).toBeDefined();
    expect(result?.toPlainDate().toString()).toBe('2025-03-16');
    expect(result?.hour).toBe(12);
  });

  it('returns undefined for "tom now" (conflict)', () => {
    const result = parseTokenBased('tom now', today, TIME_ZONE);
    expect(result).toBeUndefined();
  });

  it('returns undefined for "1d yesterday" (conflict)', () => {
    const result = parseTokenBased('1d yesterday', today, TIME_ZONE);
    expect(result).toBeUndefined();
  });

  it('parses "15 3 2025 14" as 15 Mar 2025 14:00', () => {
    const result = parseTokenBased('15 3 2025 14', today, TIME_ZONE);
    expect(result).toBeDefined();
    expect(result?.toPlainDate().toString()).toBe('2025-03-15');
    expect(result?.hour).toBe(14);
  });

  it('returns undefined for unknown tokens', () => {
    const result = parseTokenBased('gibberish stuff', today, TIME_ZONE);
    expect(result).toBeUndefined();
  });

  it('returns undefined for empty input', () => {
    const result = parseTokenBased('', today, TIME_ZONE);
    expect(result).toBeUndefined();
  });

  it('parses "today 9am" as today at 09:00', () => {
    const result = parseTokenBased('today 9am', today, TIME_ZONE);
    expect(result).toBeDefined();
    expect(result?.toPlainDate().toString()).toBe('2025-03-15');
    expect(result?.hour).toBe(9);
  });

  it('parses "15th nov" as 15 Nov', () => {
    const result = parseTokenBased('15th nov', today, TIME_ZONE);
    expect(result).toBeDefined();
    expect(result?.toPlainDate().month).toBe(11);
    expect(result?.toPlainDate().day).toBe(15);
  });

  it('returns undefined for too many tokens', () => {
    const result = parseTokenBased('1 2 3 4 5 6 7 8', today, TIME_ZONE);
    expect(result).toBeUndefined();
  });

  it('parses "yesterday 5:30pm" as yesterday at 17:30', () => {
    const result = parseTokenBased('yesterday 5:30pm', today, TIME_ZONE);
    expect(result).toBeDefined();
    expect(result?.toPlainDate().toString()).toBe('2025-03-14');
    expect(result?.hour).toBe(17);
    expect(result?.minute).toBe(30);
  });

  it('parses "today midnight" as today at 00:00', () => {
    const result = parseTokenBased('today midnight', today, TIME_ZONE);
    expect(result).toBeDefined();
    expect(result?.toPlainDate().toString()).toBe('2025-03-15');
    expect(result?.hour).toBe(0);
  });

  it('parses "15th nov 2025" as 15 Nov 2025', () => {
    const result = parseTokenBased('15th nov 2025', today, TIME_ZONE);
    expect(result).toBeDefined();
    expect(result?.toPlainDate().toString()).toBe('2025-11-15');
  });

  it('returns undefined for conflicting time keywords "noon midnight"', () => {
    const result = parseTokenBased('noon midnight', today, TIME_ZONE);
    expect(result).toBeUndefined();
  });

  it('parses "nov 10 14 30" as 10 Nov at 14:30 (month adjacency)', () => {
    const result = parseTokenBased('nov 10 14 30', today, TIME_ZONE);
    expect(result).toBeDefined();
    expect(result?.toPlainDate().month).toBe(11);
    expect(result?.toPlainDate().day).toBe(10);
    expect(result?.hour).toBe(14);
    expect(result?.minute).toBe(30);
  });

  it('parses "10 jan 2025 9" as 10 Jan 2025 09:00 (month adjacency)', () => {
    const result = parseTokenBased('10 jan 2025 9', today, TIME_ZONE);
    expect(result).toBeDefined();
    expect(result?.toPlainDate().toString()).toBe('2025-01-10');
    expect(result?.hour).toBe(9);
  });

  it('parses "2025 3 15 10 30" as 15 Mar 2025 10:30 (4-digit year certain)', () => {
    const result = parseTokenBased('2025 3 15 10 30', today, TIME_ZONE);
    expect(result).toBeDefined();
    expect(result?.toPlainDate().toString()).toBe('2025-03-15');
    expect(result?.hour).toBe(10);
    expect(result?.minute).toBe(30);
  });

  it('parses "10 11 82 10 40 50 80" as 10 Nov 1982 10:40:50.800', () => {
    const result = parseTokenBased('10 11 82 10 40 50 80', today, TIME_ZONE);
    expect(result).toBeDefined();
    expect(result?.toPlainDate().day).toBe(10);
    expect(result?.toPlainDate().month).toBe(11);
    expect(result?.toPlainDate().year).toBe(1982);
    expect(result?.hour).toBe(10);
    expect(result?.minute).toBe(40);
    expect(result?.second).toBe(50);
  });

  it('parses "tom 14" as tomorrow at 14:00', () => {
    const result = parseTokenBased('tom 14', today, TIME_ZONE);
    expect(result).toBeDefined();
    expect(result?.toPlainDate().toString()).toBe('2025-03-16');
    expect(result?.hour).toBe(14);
  });
});
