import { EDayOfWeek } from '../../constants';
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

const NOON = 12;
const MORNING_HOUR = 9;
const AFTERNOON_HOUR = 3;
const EVENING_HOUR = 7;
const TONIGHT_HOUR = 8;
const MIDNIGHT = 0;
const SHORT_NAME_LENGTH = 3;
const SEPTEMBER = 9;
export const UTC = 'UTC';

const MONTH_NAMES: readonly string[] = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
];

const OTHER_MONTH_NAMES: ReadonlyMap<string, number> = new Map([['sept', SEPTEMBER]]);

const WEEKDAY_NAMES: ReadonlyMap<string, EDayOfWeek> = new Map([
  ['monday', EDayOfWeek.Monday],
  ['tuesday', EDayOfWeek.Tuesday],
  ['wednesday', EDayOfWeek.Wednesday],
  ['thursday', EDayOfWeek.Thursday],
  ['friday', EDayOfWeek.Friday],
  ['saturday', EDayOfWeek.Saturday],
  ['sunday', EDayOfWeek.Sunday],
]);

const DATE_KEYWORDS: ReadonlyMap<string, EDateKeyword> = new Map([
  ['today', EDateKeyword.Today],
  ['tomorrow', EDateKeyword.Tomorrow],
  ['tom', EDateKeyword.Tomorrow],
  ['yesterday', EDateKeyword.Yesterday],
  ['now', EDateKeyword.Now],
]);

const DAY_PARTS: ReadonlyMap<string, Meaning> = new Map([
  ['morning', dayPart(MORNING_HOUR, EMeridiem.Am)],
  ['afternoon', dayPart(AFTERNOON_HOUR, EMeridiem.Pm)],
  ['evening', dayPart(EVENING_HOUR, EMeridiem.Pm)],
]);

const TIME_KEYWORDS: ReadonlyMap<string, number> = new Map([
  ['noon', NOON],
  ['midday', NOON],
  ['midnight', MIDNIGHT],
]);

export const EDGES: ReadonlyMap<string, EEdge> = new Map([
  ['start', EEdge.Start],
  ['beginning', EEdge.Start],
  ['end', EEdge.End],
]);

export const PERIODS: ReadonlyMap<string, EPeriod> = new Map([
  ['day', EPeriod.Day],
  ['week', EPeriod.Week],
  ['month', EPeriod.Month],
  ['quarter', EPeriod.Quarter],
  ['year', EPeriod.Year],
]);

const EDGE_LETTERS: ReadonlyMap<string, EEdge> = new Map([
  ['b', EEdge.Start],
  ['s', EEdge.Start],
  ['e', EEdge.End],
]);

const PERIOD_LETTERS: ReadonlyMap<string, EPeriod> = new Map([
  ['w', EPeriod.Week],
  ['m', EPeriod.Month],
  ['q', EPeriod.Quarter],
  ['y', EPeriod.Year],
]);

/** "eod" alone: "bod" and "sod" would be midnight, which "today" already says. */
const END_OF_DAY = 'eod';
const WEEKEND = 'weekend';

/** "m" is the month, as in "+2m"; the minute is spelled "min". */
export const UNIT_SUFFIXES: ReadonlyMap<string, EOffsetUnit> = new Map([
  ['sec', EOffsetUnit.Second],
  ['s', EOffsetUnit.Second],
  ['min', EOffsetUnit.Minute],
  ['h', EOffsetUnit.Hour],
  ['d', EOffsetUnit.Day],
  ['w', EOffsetUnit.Week],
  ['m', EOffsetUnit.Month],
  ['y', EOffsetUnit.Year],
]);

const UNIT_NAMES: ReadonlyMap<string, EOffsetUnit> = new Map([
  ['sec', EOffsetUnit.Second],
  ['secs', EOffsetUnit.Second],
  ['second', EOffsetUnit.Second],
  ['seconds', EOffsetUnit.Second],
  ['min', EOffsetUnit.Minute],
  ['mins', EOffsetUnit.Minute],
  ['minute', EOffsetUnit.Minute],
  ['minutes', EOffsetUnit.Minute],
  ['hr', EOffsetUnit.Hour],
  ['hrs', EOffsetUnit.Hour],
  ['hour', EOffsetUnit.Hour],
  ['hours', EOffsetUnit.Hour],
  ['day', EOffsetUnit.Day],
  ['days', EOffsetUnit.Day],
  ['week', EOffsetUnit.Week],
  ['weeks', EOffsetUnit.Week],
  ['month', EOffsetUnit.Month],
  ['months', EOffsetUnit.Month],
  ['year', EOffsetUnit.Year],
  ['years', EOffsetUnit.Year],
]);

const DIRECTIONS: ReadonlyMap<string, EDirection> = new Map([
  ['last', EDirection.Last],
  ['this', EDirection.This],
  ['next', EDirection.Next],
]);

export const MERIDIEMS: ReadonlyMap<string, EMeridiem> = new Map([
  ['am', EMeridiem.Am],
  ['pm', EMeridiem.Pm],
]);

const UTC_NAMES: readonly string[] = ['utc', 'gmt', 'z'];

const FILLERS: readonly string[] = ['at', 'on', 'of', 'the'];

function dayPart(hour: number, meridiem: EMeridiem): Meaning {
  return { kind: ETokenKind.DayPart, hour, meridiem };
}

export function boundaryOf(edge: EEdge, period: EPeriod, periodsAhead = 0): Meaning {
  return { kind: ETokenKind.Boundary, edge, period, periodsAhead };
}

function withShortName<Value>(name: string, value: Value): readonly [string, Value][] {
  return [
    [name, value],
    [name.slice(0, SHORT_NAME_LENGTH), value],
  ];
}

function entries<Value>(
  table: ReadonlyMap<string, Value>,
  toMeaning: (value: Value) => Meaning
): readonly [string, Meaning][] {
  return [...table].map(([word, value]) => [word, toMeaning(value)]);
}

/** A word that says two things at once: "tonight" is today, and the evening. */
const COMPOUND_WORDS: ReadonlyMap<string, readonly Meaning[]> = new Map([
  [
    'tonight',
    [
      { kind: ETokenKind.DateKeyword, keyword: EDateKeyword.Today },
      dayPart(TONIGHT_HOUR, EMeridiem.Pm),
    ],
  ],
]);

/** "bom", "eoq", "sow": the letter of an edge, "o", the letter of a period. */
const BOUNDARY_ABBREVIATIONS: readonly [string, Meaning][] = [...EDGE_LETTERS].flatMap(
  ([edgeLetter, edge]) =>
    [...PERIOD_LETTERS].map(([periodLetter, period]): [string, Meaning] => [
      `${edgeLetter}o${periodLetter}`,
      boundaryOf(edge, period),
    ])
);

const SIMPLE_WORDS: ReadonlyMap<string, Meaning> = new Map([
  ...MONTH_NAMES.flatMap((name, index) =>
    withShortName<Meaning>(name, { kind: ETokenKind.MonthName, month: index + 1 })
  ),
  ...entries(OTHER_MONTH_NAMES, month => ({ kind: ETokenKind.MonthName, month })),
  ...[...WEEKDAY_NAMES].flatMap(([name, weekday]) =>
    withShortName<Meaning>(name, { kind: ETokenKind.WeekdayName, weekday })
  ),
  ...entries(DATE_KEYWORDS, keyword => ({ kind: ETokenKind.DateKeyword, keyword })),
  ...entries(TIME_KEYWORDS, hour => ({ kind: ETokenKind.TimeKeyword, hour })),
  ...DAY_PARTS,
  ...BOUNDARY_ABBREVIATIONS,
  [END_OF_DAY, boundaryOf(EEdge.End, EPeriod.Day)],
  [WEEKEND, { kind: ETokenKind.Weekend, weeksAhead: 0 }],
  ...entries(UNIT_NAMES, unit => ({ kind: ETokenKind.Unit, unit })),
  ...entries(DIRECTIONS, direction => ({ kind: ETokenKind.Direction, direction })),
  ...entries(MERIDIEMS, meridiem => ({ kind: ETokenKind.Meridiem, meridiem })),
  ...UTC_NAMES.map((name): [string, Meaning] => [name, { kind: ETokenKind.ZoneOffset, zone: UTC }]),
  ...FILLERS.map((word): [string, Meaning] => [word, { kind: ETokenKind.Filler }]),
]);

export const WORDS: ReadonlyMap<string, readonly Meaning[]> = new Map([
  ...[...SIMPLE_WORDS].map(([word, meaning]): [string, readonly Meaning[]] => [word, [meaning]]),
  ...COMPOUND_WORDS,
]);
