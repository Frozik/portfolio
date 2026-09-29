import { isEmpty, isNil } from 'lodash-es';

import { HOURS_PER_DAY, MINUTES_PER_HOUR } from '../../constants';
import { LONGEST_MONTH, isWithin } from '../limits';
import { toFullYear } from '../year';
import type { Meaning } from './token';
import { ETokenKind } from './token';
import { MERIDIEMS, UNIT_SUFFIXES, UTC, WORDS } from './vocabulary';

export interface IShape {
  /** Lexemes the shape reads — and no shape above it does. */
  readonly examples: readonly string[];
  readonly pattern: RegExp;
  readonly read: (...parts: string[]) => readonly Meaning[] | undefined;
}

const MILLISECOND_DIGITS = 3;
const UTC_DESIGNATOR = 'z';
const ZONE_OFFSET = /^([+-])(\d{2}):?(\d{2})$/;
const OFFSET_PART = /(\d+(?:\.\d+)?)(min|sec|[smhdwy])/g;

const GLUED_AFTER_NUMBER: ReadonlySet<ETokenKind> = new Set([ETokenKind.MonthName]);

const GLUED_BEFORE_NUMBER: ReadonlySet<ETokenKind> = new Set([
  ETokenKind.MonthName,
  ETokenKind.DateKeyword,
  ETokenKind.WeekdayName,
]);

function numberOf(digits: string): Meaning {
  return { kind: ETokenKind.Number, value: Number(digits) };
}

/** A fraction finer than a millisecond is cut, not rounded: the moment must not move forward. */
function millisecondsOf(fraction: string): number {
  return Number(fraction.slice(0, MILLISECOND_DIGITS).padEnd(MILLISECOND_DIGITS, '0'));
}

function meridiemOf(suffix: string | undefined): readonly Meaning[] {
  const meridiem = isNil(suffix) ? undefined : MERIDIEMS.get(suffix);
  return isNil(meridiem) ? [] : [{ kind: ETokenKind.Meridiem, meridiem }];
}

/** "+0200" and "+02:00" alike become the identifier `Temporal` takes, "+02:00". */
function zoneOffsetOf(written: string): readonly Meaning[] | undefined {
  const [, sign, hours, minutes] = ZONE_OFFSET.exec(written) ?? [];
  const isOnTheClock =
    isWithin(Number(hours), 0, HOURS_PER_DAY - 1) &&
    isWithin(Number(minutes), 0, MINUTES_PER_HOUR - 1);

  return isOnTheClock
    ? [{ kind: ETokenKind.ZoneOffset, zone: `${sign}${hours}:${minutes}` }]
    : undefined;
}

function zoneOf(suffix: string | undefined): readonly Meaning[] | undefined {
  if (isNil(suffix)) {
    return [];
  }
  return suffix === UTC_DESIGNATOR
    ? [{ kind: ETokenKind.ZoneOffset, zone: UTC }]
    : zoneOffsetOf(suffix);
}

function quarterOf(quarter?: string, year?: string): readonly Meaning[] | undefined {
  if (isNil(quarter)) {
    return undefined;
  }
  return [
    { kind: ETokenKind.Quarter, quarter: Number(quarter) },
    ...(isNil(year) ? [] : [{ kind: ETokenKind.Year, year: toFullYear(Number(year)) } as const]),
  ];
}

/** "1h30min" is two offsets written as one; a sign in front is the sign of both. */
function offsetsOf(sign: string, parts: string): readonly Meaning[] {
  return [...parts.matchAll(OFFSET_PART)].flatMap(([, amount, suffix]) => {
    const unit = UNIT_SUFFIXES.get(suffix);
    const signed = sign === '-' ? -Number(amount) : Number(amount);

    return isNil(unit) ? [] : [{ kind: ETokenKind.Offset, amount: signed, unit }];
  });
}

function wordGluedToNumber(word: string, allowed: ReadonlySet<ETokenKind>): Meaning | undefined {
  const [meaning, ...others] = WORDS.get(word) ?? [];
  return !isNil(meaning) && isEmpty(others) && allowed.has(meaning.kind) ? meaning : undefined;
}

/** Tried top to bottom on a lower-cased lexeme; the first shape that reads it wins. */
export const SHAPES: readonly IShape[] = [
  {
    examples: ['9:30', '9:30:45.123', '5:30pm', '14:30:00z', '14:30+02:00', '14:30-0500', '10:30.'],
    pattern: /^(\d{1,2}):(\d{1,2})(?::(\d{1,2})(?:\.(\d{1,9}))?)?(am|pm)?(z|[+-]\d{2}:?\d{2})?\.?$/,
    read: (hour, minute, second?: string, fraction?: string, meridiem?: string, zone?: string) => {
      const zoneOffset = zoneOf(zone);
      if (isNil(zoneOffset)) {
        return undefined;
      }
      return [
        {
          kind: ETokenKind.ClockTime,
          hour: Number(hour),
          minute: Number(minute),
          second: isNil(second) ? undefined : Number(second),
          millisecond: isNil(fraction) ? undefined : millisecondsOf(fraction),
        },
        ...meridiemOf(meridiem),
        ...zoneOffset,
      ];
    },
  },
  {
    examples: ['+02:00', '-0500'],
    pattern: /^([+-]\d{2}:?\d{2})$/,
    read: zoneOffsetOf,
  },
  {
    examples: ['9am', '12pm'],
    pattern: /^(\d{1,2})(am|pm)$/,
    read: (hour, meridiem) => [numberOf(hour), ...meridiemOf(meridiem)],
  },
  {
    examples: ['3d', '+3d', '-1w', '-4h', '30min', '30s', '1h30min', '-1d12h', '1.5h'],
    pattern: /^([+-]?)((?:\d+(?:\.\d+)?(?:min|sec|[smhdwy]))+)$/,
    read: offsetsOf,
  },
  {
    examples: ['q1', '4q'],
    pattern: /^(?:q([1-4])|([1-4])q)$/,
    read: (leading?: string, trailing?: string) => quarterOf(leading ?? trailing),
  },
  {
    examples: ['1q25', '4q2025', "1q'25"],
    pattern: /^([1-4])q'?(\d{2}|\d{4})$/,
    read: quarterOf,
  },
  {
    examples: ["q1'25", 'q32026'],
    pattern: /^q([1-4])'?(\d{2}|\d{4})$/,
    read: quarterOf,
  },
  {
    examples: ['1st', '22nd', '15th'],
    pattern: /^(\d{1,2})(?:st|nd|rd|th)$/,
    read: day =>
      isWithin(Number(day), 1, LONGEST_MONTH)
        ? [{ kind: ETokenKind.Ordinal, day: Number(day) }]
        : undefined,
  },
  {
    examples: ["'27"],
    pattern: /^'(\d{2})$/,
    read: year => [{ kind: ETokenKind.Year, year: toFullYear(Number(year)) }],
  },
  {
    examples: ['15', '2025', '1.5'],
    pattern: /^(\d+(?:\.\d+)?)$/,
    read: digits => [numberOf(digits)],
  },
  {
    examples: ['10nov', '15nov2025'],
    pattern: /^(\d+)([a-z]+)(\d*)$/,
    read: (before, word, after) => {
      const meaning = wordGluedToNumber(word, GLUED_AFTER_NUMBER);
      if (isNil(meaning)) {
        return undefined;
      }
      return [numberOf(before), meaning, ...(isEmpty(after) ? [] : [numberOf(after)])];
    },
  },
  {
    examples: ['nov10', 'tom9', 'mon14'],
    pattern: /^([a-z]+)(\d+)$/,
    read: (word, after) => {
      const meaning = wordGluedToNumber(word, GLUED_BEFORE_NUMBER);
      return isNil(meaning) ? undefined : [meaning, numberOf(after)];
    },
  },
];
