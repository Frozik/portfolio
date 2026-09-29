import { describe, expect, it } from 'vitest';

import { EDayOfWeek } from '../../constants';
import { classify } from './classify';
import { ESeparator } from './lexeme';
import { PHRASES } from './phrases';
import { scan } from './scanner';
import { SHAPES } from './shapes';
import type { Meaning } from './token';
import {
  EDateKeyword,
  EDirection,
  EEdge,
  EMeridiem,
  EOffsetUnit,
  EPeriod,
  ETokenKind,
} from './token';
import { tokenize } from './tokenize';

function edge(side: EEdge, period: EPeriod, periodsAhead = 0): Meaning {
  return { kind: ETokenKind.Boundary, edge: side, period, periodsAhead };
}

function meanings(input: string): readonly Meaning[] {
  return tokenize(input).map(({ text: _text, joint: _joint, ...meaning }) => meaning);
}

describe('tokenize', () => {
  describe('words', () => {
    it.each<[string, Meaning]>([
      ['jan', { kind: ETokenKind.MonthName, month: 1 }],
      ['December', { kind: ETokenKind.MonthName, month: 12 }],
      ['monday', { kind: ETokenKind.WeekdayName, weekday: EDayOfWeek.Monday }],
      ['sun', { kind: ETokenKind.WeekdayName, weekday: EDayOfWeek.Sunday }],
      ['tomorrow', { kind: ETokenKind.DateKeyword, keyword: EDateKeyword.Tomorrow }],
      ['tom', { kind: ETokenKind.DateKeyword, keyword: EDateKeyword.Tomorrow }],
      ['now', { kind: ETokenKind.DateKeyword, keyword: EDateKeyword.Now }],
      ['noon', { kind: ETokenKind.TimeKeyword, hour: 12 }],
      ['midday', { kind: ETokenKind.TimeKeyword, hour: 12 }],
      ['midnight', { kind: ETokenKind.TimeKeyword, hour: 0 }],
      ['morning', { kind: ETokenKind.DayPart, hour: 9, meridiem: EMeridiem.Am }],
      ['evening', { kind: ETokenKind.DayPart, hour: 7, meridiem: EMeridiem.Pm }],
      ['weekend', { kind: ETokenKind.Weekend, weeksAhead: 0 }],
      ['sept', { kind: ETokenKind.MonthName, month: 9 }],
      ['eom', edge(EEdge.End, EPeriod.Month)],
      ['soy', edge(EEdge.Start, EPeriod.Year)],
      ['bow', edge(EEdge.Start, EPeriod.Week)],
      ['eod', edge(EEdge.End, EPeriod.Day)],
      ['utc', { kind: ETokenKind.ZoneOffset, zone: 'UTC' }],
      ['hrs', { kind: ETokenKind.Unit, unit: EOffsetUnit.Hour }],
      ['pm', { kind: ETokenKind.Meridiem, meridiem: EMeridiem.Pm }],
      ['next', { kind: ETokenKind.Direction, direction: EDirection.Next }],
      ['days', { kind: ETokenKind.Unit, unit: EOffsetUnit.Day }],
      ['gibberish', { kind: ETokenKind.Unknown }],
    ])('reads "%s"', (input, expected) => {
      expect(meanings(input)).toEqual([expected]);
    });
  });

  describe('shapes', () => {
    it.each<[string, readonly Meaning[]]>([
      ['13:00', [{ kind: ETokenKind.ClockTime, hour: 13, minute: 0 }]],
      ['9:30:45', [{ kind: ETokenKind.ClockTime, hour: 9, minute: 30, second: 45 }]],
      [
        '9:30:45.123',
        [{ kind: ETokenKind.ClockTime, hour: 9, minute: 30, second: 45, millisecond: 123 }],
      ],
      [
        '9:30:45.1',
        [{ kind: ETokenKind.ClockTime, hour: 9, minute: 30, second: 45, millisecond: 100 }],
      ],
      [
        '5:30pm',
        [
          { kind: ETokenKind.ClockTime, hour: 5, minute: 30 },
          { kind: ETokenKind.Meridiem, meridiem: EMeridiem.Pm },
        ],
      ],
      [
        '9am',
        [
          { kind: ETokenKind.Number, value: 9 },
          { kind: ETokenKind.Meridiem, meridiem: EMeridiem.Am },
        ],
      ],
      [
        '9:30:45.123456789',
        [{ kind: ETokenKind.ClockTime, hour: 9, minute: 30, second: 45, millisecond: 123 }],
      ],
      ['10:30.', [{ kind: ETokenKind.ClockTime, hour: 10, minute: 30 }]],
      [
        '14:30:00Z',
        [
          { kind: ETokenKind.ClockTime, hour: 14, minute: 30, second: 0 },
          { kind: ETokenKind.ZoneOffset, zone: 'UTC' },
        ],
      ],
      [
        '14:30-05:00',
        [
          { kind: ETokenKind.ClockTime, hour: 14, minute: 30 },
          { kind: ETokenKind.ZoneOffset, zone: '-05:00' },
        ],
      ],
      ['+3d', [{ kind: ETokenKind.Offset, amount: 3, unit: EOffsetUnit.Day }]],
      ['-1w', [{ kind: ETokenKind.Offset, amount: -1, unit: EOffsetUnit.Week }]],
      ['2m', [{ kind: ETokenKind.Offset, amount: 2, unit: EOffsetUnit.Month }]],
      ['1Y', [{ kind: ETokenKind.Offset, amount: 1, unit: EOffsetUnit.Year }]],
      ['-4h', [{ kind: ETokenKind.Offset, amount: -4, unit: EOffsetUnit.Hour }]],
      ['30min', [{ kind: ETokenKind.Offset, amount: 30, unit: EOffsetUnit.Minute }]],
      ['Q1', [{ kind: ETokenKind.Quarter, quarter: 1 }]],
      ['4q', [{ kind: ETokenKind.Quarter, quarter: 4 }]],
      [
        '1Q25',
        [
          { kind: ETokenKind.Quarter, quarter: 1 },
          { kind: ETokenKind.Year, year: 2025 },
        ],
      ],
      [
        "4q'2025",
        [
          { kind: ETokenKind.Quarter, quarter: 4 },
          { kind: ETokenKind.Year, year: 2025 },
        ],
      ],
      [
        "q1'25",
        [
          { kind: ETokenKind.Quarter, quarter: 1 },
          { kind: ETokenKind.Year, year: 2025 },
        ],
      ],
      ['15th', [{ kind: ETokenKind.Ordinal, day: 15 }]],
      ['1st', [{ kind: ETokenKind.Ordinal, day: 1 }]],
      ["'27", [{ kind: ETokenKind.Year, year: 2027 }]],
      ['2025', [{ kind: ETokenKind.Number, value: 2025 }]],
      ['05', [{ kind: ETokenKind.Number, value: 5 }]],
    ])('reads "%s"', (input, expected) => {
      expect(meanings(input)).toEqual(expected);
    });

    it.each(['32nd', '0th', 'q5', '5q', '10:30+25:00', '10:30+02:60', 'hello10', '10hello'])(
      'does not read "%s"',
      input => {
        expect(meanings(input)).toEqual([{ kind: ETokenKind.Unknown }]);
      }
    );
  });

  describe('words glued to numbers', () => {
    it.each<[string, readonly Meaning[]]>([
      [
        '10nov',
        [
          { kind: ETokenKind.Number, value: 10 },
          { kind: ETokenKind.MonthName, month: 11 },
        ],
      ],
      [
        '15november2025',
        [
          { kind: ETokenKind.Number, value: 15 },
          { kind: ETokenKind.MonthName, month: 11 },
          { kind: ETokenKind.Number, value: 2025 },
        ],
      ],
      [
        'January20',
        [
          { kind: ETokenKind.MonthName, month: 1 },
          { kind: ETokenKind.Number, value: 20 },
        ],
      ],
      [
        'yesterday10',
        [
          { kind: ETokenKind.DateKeyword, keyword: EDateKeyword.Yesterday },
          { kind: ETokenKind.Number, value: 10 },
        ],
      ],
      [
        'friday18',
        [
          { kind: ETokenKind.WeekdayName, weekday: EDayOfWeek.Friday },
          { kind: ETokenKind.Number, value: 18 },
        ],
      ],
    ])('reads "%s" as if a space stood between them', (input, expected) => {
      expect(meanings(input)).toEqual(expected);
    });

    it('does not split a weekday or a keyword written after the number', () => {
      expect(meanings('10mon')).toEqual([{ kind: ETokenKind.Unknown }]);
      expect(meanings('10tom')).toEqual([{ kind: ETokenKind.Unknown }]);
    });
  });

  describe('phrases', () => {
    it.each<[string, Meaning]>([
      ['end of month', edge(EEdge.End, EPeriod.Month)],
      ['End-Of-Month', edge(EEdge.End, EPeriod.Month)],
      ['beginning of year', edge(EEdge.Start, EPeriod.Year)],
      ['start of month', edge(EEdge.Start, EPeriod.Month)],
      ['end of quarter', edge(EEdge.End, EPeriod.Quarter)],
      ['end of day', edge(EEdge.End, EPeriod.Day)],
      ['start of week', edge(EEdge.Start, EPeriod.Week)],
      ['end of next month', edge(EEdge.End, EPeriod.Month, 1)],
      ['start of last year', edge(EEdge.Start, EPeriod.Year, -1)],
      ['end of this quarter', edge(EEdge.End, EPeriod.Quarter)],
      ['p.m.', { kind: ETokenKind.Meridiem, meridiem: EMeridiem.Pm }],
      ['a.m.', { kind: ETokenKind.Meridiem, meridiem: EMeridiem.Am }],
      ['day after tomorrow', { kind: ETokenKind.Offset, amount: 2, unit: EOffsetUnit.Day }],
      ['day before yesterday', { kind: ETokenKind.Offset, amount: -2, unit: EOffsetUnit.Day }],
      ['in a week', { kind: ETokenKind.Offset, amount: 1, unit: EOffsetUnit.Week }],
      ['an hour ago', { kind: ETokenKind.Offset, amount: -1, unit: EOffsetUnit.Hour }],
      ['next week', { kind: ETokenKind.Offset, amount: 1, unit: EOffsetUnit.Week }],
      ['next weekend', { kind: ETokenKind.Weekend, weeksAhead: 1 }],
      ['last weekend', { kind: ETokenKind.Weekend, weeksAhead: -1 }],
      ['last year', { kind: ETokenKind.Offset, amount: -1, unit: EOffsetUnit.Year }],
      ['this month', { kind: ETokenKind.Offset, amount: 0, unit: EOffsetUnit.Month }],
      ['in 30 seconds', { kind: ETokenKind.Offset, amount: 30, unit: EOffsetUnit.Second }],
      ['in 3 days', { kind: ETokenKind.Offset, amount: 3, unit: EOffsetUnit.Day }],
      ['2 weeks ago', { kind: ETokenKind.Offset, amount: -2, unit: EOffsetUnit.Week }],
      ['3 months', { kind: ETokenKind.Offset, amount: 3, unit: EOffsetUnit.Month }],
      ['in 2 hours', { kind: ETokenKind.Offset, amount: 2, unit: EOffsetUnit.Hour }],
      ['90 mins ago', { kind: ETokenKind.Offset, amount: -90, unit: EOffsetUnit.Minute }],
      [
        'next fri',
        {
          kind: ETokenKind.RelativeWeekday,
          weekday: EDayOfWeek.Friday,
          direction: EDirection.Next,
        },
      ],
      [
        'last monday',
        {
          kind: ETokenKind.RelativeWeekday,
          weekday: EDayOfWeek.Monday,
          direction: EDirection.Last,
        },
      ],
    ])('reads "%s" as one token', (input, expected) => {
      expect(meanings(input)).toEqual([expected]);
    });

    it('leaves the words of a broken phrase as they are', () => {
      expect(meanings('in 3')).toEqual([
        { kind: ETokenKind.Unknown },
        { kind: ETokenKind.Number, value: 3 },
      ]);
    });
  });

  it('reads the ISO "T" between a date and a time as a space', () => {
    expect(meanings('2024-01-15T14:30')).toEqual([
      { kind: ETokenKind.Number, value: 2024 },
      { kind: ETokenKind.Number, value: 1 },
      { kind: ETokenKind.Number, value: 15 },
      { kind: ETokenKind.ClockTime, hour: 14, minute: 30 },
    ]);
  });

  it('takes the dash that joins an offset to the word before it for the minus', () => {
    expect(meanings('eom-4h')).toEqual([
      edge(EEdge.End, EPeriod.Month),
      { kind: ETokenKind.Offset, amount: -4, unit: EOffsetUnit.Hour },
    ]);
    expect(tokenize('eom-4h').map(token => token.joint)).toEqual([undefined, undefined]);
  });

  it('hands the joint of a lexeme to the first token read from it', () => {
    expect(tokenize('15/nov10').map(token => token.joint)).toEqual([
      undefined,
      ESeparator.Slash,
      undefined,
    ]);
  });

  describe('the tables', () => {
    it.each(SHAPES.flatMap(shape => shape.examples.map(example => ({ example, shape }))))(
      'read "$example" by the shape that gives it as an example',
      ({ example, shape }) => {
        expect(SHAPES.find(({ pattern }) => pattern.test(example))).toBe(shape);
        expect(meanings(example)).not.toContainEqual({ kind: ETokenKind.Unknown });
      }
    );

    it.each(PHRASES.map(phrase => ({ phrase, example: phrase.example })))(
      'read "$example" by the phrase that gives it as an example',
      ({ phrase, example }) => {
        const words = scan(example).flatMap(classify);

        expect(PHRASES.find(({ read, length }) => read(words.slice(0, length)))).toBe(phrase);
        expect(meanings(example)).not.toContainEqual({ kind: ETokenKind.Unknown });
      }
    );
  });

  describe('words that only join the others', () => {
    it.each(['at', 'on', 'of', 'the'])('drops "%s"', filler => {
      expect(meanings(`${filler} 15th ${filler} jan`)).toEqual([
        { kind: ETokenKind.Ordinal, day: 15 },
        { kind: ETokenKind.MonthName, month: 1 },
      ]);
    });

    it('keeps them where a phrase needs them', () => {
      expect(meanings('end of month')).toEqual([edge(EEdge.End, EPeriod.Month)]);
    });
  });

  describe('compound offsets', () => {
    it('reads the parts written together as offsets of their own', () => {
      expect(meanings('1h30min')).toEqual([
        { kind: ETokenKind.Offset, amount: 1, unit: EOffsetUnit.Hour },
        { kind: ETokenKind.Offset, amount: 30, unit: EOffsetUnit.Minute },
      ]);
    });

    it('gives the sign in front to every part', () => {
      expect(meanings('-1d12h')).toEqual([
        { kind: ETokenKind.Offset, amount: -1, unit: EOffsetUnit.Day },
        { kind: ETokenKind.Offset, amount: -12, unit: EOffsetUnit.Hour },
      ]);
      expect(meanings('eom-1d12h').slice(1)).toEqual(meanings('-1d12h'));
    });

    it.each(['1/2d', '9:30h'])('does not read "%s", torn by a separator', input => {
      expect(meanings(input)).toContainEqual({ kind: ETokenKind.Unknown });
    });
  });

  describe('numbers with a fraction', () => {
    it.each<[string, Meaning]>([
      ['1.5h', { kind: ETokenKind.Offset, amount: 1.5, unit: EOffsetUnit.Hour }],
      ['1,5h', { kind: ETokenKind.Offset, amount: 1.5, unit: EOffsetUnit.Hour }],
      ['-0.25d', { kind: ETokenKind.Offset, amount: -0.25, unit: EOffsetUnit.Day }],
      ['1.5 hours', { kind: ETokenKind.Offset, amount: 1.5, unit: EOffsetUnit.Hour }],
      ['in 2,5 days', { kind: ETokenKind.Offset, amount: 2.5, unit: EOffsetUnit.Day }],
    ])('reads "%s" as one offset', (input, expected) => {
      expect(meanings(input)).toEqual([expected]);
    });

    it('takes the dash before the number for the minus of the whole', () => {
      expect(meanings('eom-1.5h')).toEqual([
        edge(EEdge.End, EPeriod.Month),
        { kind: ETokenKind.Offset, amount: -1.5, unit: EOffsetUnit.Hour },
      ]);
    });

    it.each(['15.03', '15.03.2025', '9.30', '1.5'])(
      'leaves "%s", which runs into no unit, as separate numbers',
      input => {
        expect(meanings(input).every(meaning => meaning.kind === ETokenKind.Number)).toBe(true);
        expect(meanings(input).length).toBeGreaterThan(1);
      }
    );
  });

  describe('words that say two things', () => {
    it('reads "tonight" as today and the evening', () => {
      expect(meanings('tonight')).toEqual([
        { kind: ETokenKind.DateKeyword, keyword: EDateKeyword.Today },
        { kind: ETokenKind.DayPart, hour: 8, meridiem: EMeridiem.Pm },
      ]);
    });

    it('does not glue them to a number', () => {
      expect(meanings('tonight9')).toEqual([{ kind: ETokenKind.Unknown }]);
    });
  });

  describe('time zones', () => {
    it.each([
      ['+02:00', '+02:00'],
      ['+0200', '+02:00'],
      ['-0530', '-05:30'],
      ['Z', 'UTC'],
      ['GMT', 'UTC'],
    ])('reads "%s" as the zone %s', (input, zone) => {
      expect(meanings(input)).toEqual([{ kind: ETokenKind.ZoneOffset, zone }]);
    });

    it('reads an offset written after the time without a colon', () => {
      expect(meanings('14:30:00+0200')).toEqual([
        { kind: ETokenKind.ClockTime, hour: 14, minute: 30, second: 0 },
        { kind: ETokenKind.ZoneOffset, zone: '+02:00' },
      ]);
    });
  });

  describe('a time written with a dot', () => {
    it('reads "9.30pm" as a clock time', () => {
      expect(meanings('9.30pm')).toEqual([
        { kind: ETokenKind.ClockTime, hour: 9, minute: 30 },
        { kind: ETokenKind.Meridiem, meridiem: EMeridiem.Pm },
      ]);
    });

    it('leaves "9.30" without am or pm to be a date', () => {
      expect(meanings('9.30')).toEqual([
        { kind: ETokenKind.Number, value: 9 },
        { kind: ETokenKind.Number, value: 30 },
      ]);
    });
  });

  describe('text copied from a page', () => {
    it.each([
      ['15\u00a0jan', '15 jan'],
      ['\uff11\uff15 jan', '15 jan'],
      ['15\u201303', '15-03'],
      ['\u22124h', '-4h'],
    ])('reads "%s" as "%s"', (copied, typed) => {
      expect(meanings(copied)).toEqual(meanings(typed));
      expect(tokenize(copied).map(token => token.joint)).toEqual(
        tokenize(typed).map(token => token.joint)
      );
    });
  });

  it('keeps the lexeme each token was read from', () => {
    expect(tokenize('Jan 15th in 3 days').map(token => token.text)).toEqual([
      'Jan',
      '15th',
      'in 3 days',
    ]);
  });
});
