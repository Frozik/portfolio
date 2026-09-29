import { describe, expect, it } from 'vitest';

import { tokenize } from '../lexer/tokenize';
import { ALL_SLOTS, DATE_SLOTS, ESlot, TIME_SLOTS } from '../slot';
import { SCORING_RULES } from './rules';
import { scoreCandidates } from './score-candidates';
import type { ICandidate } from './scoreboard';
import { isPossible } from './weights';

function score(input: string): readonly ICandidate[] {
  return scoreCandidates(tokenize(input));
}

function numbers(input: string): readonly number[] {
  return score(input).map(candidate => candidate.token.value);
}

function possibleSlots(candidate: ICandidate): readonly ESlot[] {
  return ALL_SLOTS.filter(slot => isPossible(candidate.weights, slot));
}

function strongestSlot({ weights }: ICandidate): ESlot {
  return ALL_SLOTS.reduce((strongest, slot) =>
    weights[slot] > weights[strongest] ? slot : strongest
  );
}

function canBeAnyOf(candidate: ICandidate, slots: readonly ESlot[]): boolean {
  return slots.some(slot => isPossible(candidate.weights, slot));
}

describe('scoreCandidates', () => {
  it('weighs the bare numbers and nothing else', () => {
    expect(numbers('10 nov 2025')).toEqual([10, 2025]);
    expect(numbers("15th jan '27 13:00")).toEqual([]);
  });

  describe('what the words state', () => {
    it('leaves no number the month once the month is named', () => {
      for (const candidate of score('10 nov 2025')) {
        expect(isPossible(candidate.weights, ESlot.Month)).toBe(false);
      }
    });

    it.each(['tom 10 30', 'eom 10 30', 'mon 10 30', 'next fri 10 30'])(
      'leaves the numbers of "%s" no part of the date',
      input => {
        for (const candidate of score(input)) {
          expect(canBeAnyOf(candidate, DATE_SLOTS)).toBe(false);
        }
      }
    );

    it.each(['15 jan 13:00', '15 jan noon'])(
      'leaves the numbers of "%s" no hour and no minute',
      input => {
        for (const candidate of score(input)) {
          expect(canBeAnyOf(candidate, [ESlot.Hour, ESlot.Minute])).toBe(false);
        }
      }
    );

    it('leaves the seconds open after a clock time that shows none', () => {
      const [seconds] = score('tom 13:00 45');

      expect(possibleSlots(seconds)).toEqual([ESlot.Second]);
    });

    it('leaves a number beside an ordinal no part of the date', () => {
      const [hour] = score('15th 10');

      expect(canBeAnyOf(hour, DATE_SLOTS)).toBe(false);
    });
  });

  describe('beside an offset', () => {
    it('leaves a loose number written after it no part of the date', () => {
      const [hour] = score('+1d 15');

      expect(canBeAnyOf(hour, DATE_SLOTS)).toBe(false);
    });

    it('reads a date written before it or with separators as usual', () => {
      expect(score('15.03.2025 +1d').map(candidate => candidate.seat)).toEqual([
        ESlot.Day,
        ESlot.Month,
        ESlot.Year,
      ]);
      expect(score('+1d 15.03.2025').map(candidate => candidate.seat)).toEqual([
        ESlot.Day,
        ESlot.Month,
        ESlot.Year,
      ]);
    });
  });

  describe('beside a weekday', () => {
    it('leaves the numbers no part of the date while the weekday alone tells it', () => {
      for (const candidate of score('mon 14 30')) {
        expect(canBeAnyOf(candidate, DATE_SLOTS)).toBe(false);
      }
    });

    it('reads the date as usual once something else tells it', () => {
      expect(score('wed 15 jan 2025').map(candidate => candidate.seat)).toEqual([
        ESlot.Day,
        ESlot.Year,
      ]);
      expect(score('wed 15.01.2025').map(candidate => candidate.seat)).toEqual([
        ESlot.Day,
        ESlot.Month,
        ESlot.Year,
      ]);
    });
  });

  describe('beside a month name', () => {
    it.each(['nov 10', '10 nov', '10nov', 'nov10'])(
      'settles the number of "%s" as the day',
      input => {
        const [day] = score(input);

        expect(possibleSlots(day)).toEqual([ESlot.Day]);
      }
    );

    it('takes the number before the month for the day when numbers stand on both sides', () => {
      const [day, hour] = score('10 nov 12');

      expect(possibleSlots(day)).toEqual([ESlot.Day]);
      expect(strongestSlot(hour)).toBe(ESlot.Hour);
    });

    it('takes the number a year follows for the day', () => {
      const [hour, minute, day, year] = score('8 30 jan 15, 2025');

      expect(strongestSlot(hour)).toBe(ESlot.Hour);
      expect(strongestSlot(minute)).toBe(ESlot.Minute);
      expect(possibleSlots(day)).toEqual([ESlot.Day]);
      expect(possibleSlots(year)).toEqual([ESlot.Year]);
    });

    it('takes a number after the date for the year only when no hour can hold it', () => {
      const [, year] = score('15 jan 27');
      const [, hour] = score('15 jan 17');

      expect(possibleSlots(year)).toEqual([ESlot.Year]);
      expect(strongestSlot(hour)).toBe(ESlot.Hour);
    });
  });

  describe('beside am or pm', () => {
    it('settles the number before it as the hour', () => {
      const [hour] = score('10 pm');

      expect(possibleSlots(hour)).toEqual([ESlot.Hour]);
    });

    it('prefers the hour to the day beside a month name', () => {
      const [hour] = score('jan 1 pm');

      expect(possibleSlots(hour)).toEqual([ESlot.Hour]);
    });
  });

  describe('date separators', () => {
    it('leaves joined numbers no part of the time', () => {
      for (const candidate of score('15/03/2024')) {
        expect(canBeAnyOf(candidate, TIME_SLOTS)).toBe(false);
      }
    });

    it('leaves the loose numbers beside them no part of the date', () => {
      const [hour, minute] = score('8 30 25.06.99');

      expect(canBeAnyOf(hour, DATE_SLOTS)).toBe(false);
      expect(canBeAnyOf(minute, DATE_SLOTS)).toBe(false);
    });
  });

  describe('reading order', () => {
    it.each<[string, readonly ESlot[]]>([
      ['15 03 2025', [ESlot.Day, ESlot.Month, ESlot.Year]],
      ['15 06 27', [ESlot.Day, ESlot.Month, ESlot.Year]],
      ['2025-03-15', [ESlot.Year, ESlot.Month, ESlot.Day]],
      ['01/2027', [ESlot.Month, ESlot.Year]],
      ['15 03 2025 10 30', [ESlot.Day, ESlot.Month, ESlot.Year, ESlot.Hour, ESlot.Minute]],
      ['tom 10 30 45 900', [ESlot.Hour, ESlot.Minute, ESlot.Second, ESlot.Millisecond]],
      ['8 30 25.06', [ESlot.Hour, ESlot.Minute, ESlot.Day, ESlot.Month]],
      ['10 30', [ESlot.Hour, ESlot.Minute]],
      ['25 12', [ESlot.Day, ESlot.Month]],
      ['15 17 05', [ESlot.Hour, ESlot.Minute, ESlot.Second]],
      ['8 30 27', [ESlot.Month, ESlot.Day, ESlot.Year]],
      ['99 12 31', [ESlot.Year, ESlot.Month, ESlot.Day]],
      ['12 99', [ESlot.Month, ESlot.Year]],
      ['25 12 17 30', [ESlot.Day, ESlot.Month, ESlot.Hour, ESlot.Minute]],
      ['8 30 15 06 27', [ESlot.Month, ESlot.Day, ESlot.Year, ESlot.Hour, ESlot.Minute]],
      ['5 03 8:05 45', [ESlot.Day, ESlot.Month, ESlot.Second]],
      ['8:05 45 5 03', [ESlot.Second, ESlot.Day, ESlot.Month]],
    ])('seats the numbers of "%s"', (input, seats) => {
      expect(score(input).map(candidate => candidate.seat)).toEqual(seats);
    });

    it('leaves a seated number no reading but its seat', () => {
      expect(score('15 03 2025 10 30').map(possibleSlots)).toEqual([
        [ESlot.Day],
        [ESlot.Month],
        [ESlot.Year],
        [ESlot.Hour],
        [ESlot.Minute],
      ]);
    });

    it('leaves the numbers no reading when no order seats them all', () => {
      expect(score('2025 13 01').map(possibleSlots)).toEqual([[], [], []]);
      expect(score('1 2 3 4 5 6 7 8').flatMap(possibleSlots)).toEqual([]);
    });

    it('leaves a lone number before a year no chance to be the day', () => {
      const [month] = score('01/2027');

      expect(isPossible(month.weights, ESlot.Day)).toBe(false);
    });
  });

  describe('the trail of rules', () => {
    it('names the rules that changed a number, in the order they did', () => {
      const [day, year] = score('5 jan 27');

      expect(day.changedBy).toEqual([
        'what the words state, no number can be',
        'the number beside the month name is the day',
      ]);
      expect(year.changedBy).toEqual([
        'a number after the date, too large for an hour, is the year',
      ]);
    });

    it('names the order a number was seated by', () => {
      const [year] = score('2025-03-15');

      expect(year.changedBy).toContain(
        'the numbers are read in the order people write them: year month day'
      );
    });

    it('gives every rule a name of its own', () => {
      const names = SCORING_RULES.map(rule => rule.name);

      expect(new Set(names).size).toBe(names.length);
    });
  });

  describe('beside am or pm, minutes', () => {
    it('takes a number too large for the dial for the minute of the hour before it', () => {
      const [hour, minute] = score('9 30 pm');

      expect(possibleSlots(hour)).toEqual([ESlot.Hour]);
      expect(possibleSlots(minute)).toEqual([ESlot.Minute]);
    });
  });

  describe('a date written with separators', () => {
    it('keeps every number to its place in the date', () => {
      expect(score('15/06/17').map(possibleSlots)).toEqual([
        [ESlot.Day],
        [ESlot.Month],
        [ESlot.Year],
      ]);
    });

    it('leaves a number that does not fit its place no reading at all', () => {
      const [, month] = score('2025-13-01');

      expect(possibleSlots(month)).toEqual([]);
    });
  });

  describe('the order the time is written in', () => {
    it('lets no number be the minute unless an hour stands right before it', () => {
      const [first] = score('45 10');

      expect(first.changedBy).toContain('a minute is written right after its hour');
      expect(possibleSlots(first)).toEqual([]);
    });

    it('lets no number be the millisecond unless a second stands right before it', () => {
      const [milliseconds] = score('tom 13:00 900');

      expect(possibleSlots(milliseconds)).toEqual([]);
    });
  });
});
