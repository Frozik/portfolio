import { Temporal } from '@js-temporal/polyfill';
import { isNil } from 'lodash-es';

import type { DateTimeParseResult } from './types';

const DAYS_IN_WEEK = 7;

// ── Month lookup ──────────────────────────────────────────────────────

const MONTH_MAP: ReadonlyMap<string, number> = new Map([
  ['jan', 1],
  ['january', 1],
  ['feb', 2],
  ['february', 2],
  ['mar', 3],
  ['march', 3],
  ['apr', 4],
  ['april', 4],
  ['may', 5],
  ['jun', 6],
  ['june', 6],
  ['jul', 7],
  ['july', 7],
  ['aug', 8],
  ['august', 8],
  ['sep', 9],
  ['september', 9],
  ['oct', 10],
  ['october', 10],
  ['nov', 11],
  ['november', 11],
  ['dec', 12],
  ['december', 12],
]);

// ── Weekday lookup ────────────────────────────────────────────────────

const WEEKDAY_MAP: ReadonlyMap<string, number> = new Map([
  ['mon', 1],
  ['monday', 1],
  ['tue', 2],
  ['tuesday', 2],
  ['wed', 3],
  ['wednesday', 3],
  ['thu', 4],
  ['thursday', 4],
  ['fri', 5],
  ['friday', 5],
  ['sat', 6],
  ['saturday', 6],
  ['sun', 7],
  ['sunday', 7],
]);

// ── Quarter start months ──────────────────────────────────────────────

const QUARTER_START_MONTH: ReadonlyMap<number, number> = new Map([
  [1, 1],
  [2, 4],
  [3, 7],
  [4, 10],
]);

const QUARTER_END: ReadonlyMap<number, { month: number; day: number }> = new Map([
  [1, { month: 3, day: 31 }],
  [2, { month: 6, day: 30 }],
  [3, { month: 9, day: 30 }],
  [4, { month: 12, day: 31 }],
]);

// ── Regexes for direct date formats ───────────────────────────────────

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
const SLASH_DATE_REGEX = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const DOT_DATE_REGEX = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
const DASH_DATE_DD_MM_YYYY_REGEX = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;

// ── Regexes for extended formats ──────────────────────────────────────

const MONTH_NAME_REGEX =
  /^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)$/i;

// Month + 4-digit year OR month + apostrophe + 2-digit year (jan 2027, jan '27)
// Does NOT match "jan 15" (that's a partial day+month, not a year)
const MONTH_YEAR_REGEX =
  /^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(?:'(\d{2})|(\d{4}))$/i;

const YEAR_MONTH_REGEX =
  /^(\d{4})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)$/i;

const ISO_MONTH_REGEX = /^(\d{4})-(\d{2})$/;
const SLASH_MONTH_REGEX = /^(\d{1,2})\/(\d{4})$/;

// day + month name: "15 jan", "15th jan", "jan 15", "jan 15th"
const DAY_MONTH_REGEX =
  /^(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)$/i;

const MONTH_DAY_REGEX =
  /^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?$/i;

// full date with month name: "15 jan 2025", "jan 15 2025", "jan 15, 2025"
const DAY_MONTH_YEAR_REGEX =
  /^(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+'?(\d{2,4})$/i;

const MONTH_DAY_YEAR_REGEX =
  /^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+'?(\d{2,4})$/i;

// quarter: "Q1", "Q1 2025", "Q1/2025", "1Q25", "1Q2025"
const QUARTER_Q_REGEX = /^q([1-4])(?:[\s/]'?(\d{2,4}))?$/i;
const QUARTER_NQ_REGEX = /^([1-4])q'?(\d{2,4})$/i;

// offset: "+3d", "-1w", "+2m", "+1y"
const OFFSET_REGEX = /^([+-])(\d+)\s*(d|w|m|y)$/i;

// unsigned duration: "3w", "1d", "1m", "1y" (always forward from today)
const DURATION_REGEX = /^(\d+)\s*(d|w|m|y)$/i;

// "in N days/weeks/months/years"
const IN_N_UNITS_REGEX = /^in\s+(\d+)\s+(day|week|month|year)s?$/i;

// "N days/weeks/months/years ago"
const N_UNITS_AGO_REGEX = /^(\d+)\s+(day|week|month|year)s?\s+ago$/i;

// "next/last monday", "next friday"
const NEXT_LAST_WEEKDAY_REGEX =
  /^(next|last)\s+(mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)$/i;

// numeric date with spaces: "15 06 27", "15 06 2027" (DD MM YY or DD MM YYYY)
const NUMERIC_SPACE_DATE_REGEX = /^(\d{1,2})\s+(\d{1,2})\s+(\d{2,4})$/;

// numeric date with spaces: "15 06 27", "15 06 2027" (DD MM YY or DD MM YYYY)

// ordinal day of current month: "15th", "the 15th", "the 1st"
const ORDINAL_DAY_REGEX = /^(?:the\s+)?(\d{1,2})(?:st|nd|rd|th)$/i;

// ── Time regexes ──────────────────────────────────────────────────────

// Standalone time: "13:00", "9:30:45", "13:00:45.123"
const STANDALONE_TIME_REGEX = /^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

// AM/PM time: "9am", "2pm", "5:30pm", "11:30:00am"
const AMPM_TIME_REGEX = /^(\d{1,2})(?::(\d{2})(?::(\d{2}))?)?\s*(am|pm)$/i;

// Time suffix at the end of a date expression: " 13:00", " 9:30:45.123"
const TIME_SUFFIX_REGEX = /\s+(\d{1,2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

// AM/PM suffix: " 9am", " 2pm", " 5:30pm"
const AMPM_SUFFIX_REGEX = /\s+(\d{1,2})(?::(\d{2})(?::(\d{2}))?)?\s*(am|pm)$/i;

// ── Public parsing functions ──────────────────────────────────────────

/**
 * Resolve day name abbreviation (mon, tue, monday, tuesday, etc.) to next occurrence.
 * If today is the named day, returns NEXT week's occurrence.
 */
export function resolveNextWeekday(
  dayName: string,
  today: Temporal.PlainDate
): Temporal.PlainDate | undefined {
  const targetDay = WEEKDAY_MAP.get(dayName.toLowerCase());

  if (isNil(targetDay)) {
    return undefined;
  }

  const currentDay = today.dayOfWeek;
  const daysUntil = (targetDay - currentDay + DAYS_IN_WEEK) % DAYS_IN_WEEK;
  const offset = daysUntil === 0 ? DAYS_IN_WEEK : daysUntil;

  return today.add({ days: offset });
}

/**
 * Resolve previous occurrence of a weekday (last monday, last friday).
 * If today is the named day, returns PREVIOUS week's occurrence.
 */
export function resolvePreviousWeekday(
  dayName: string,
  today: Temporal.PlainDate
): Temporal.PlainDate | undefined {
  const targetDay = WEEKDAY_MAP.get(dayName.toLowerCase());

  if (isNil(targetDay)) {
    return undefined;
  }

  const currentDay = today.dayOfWeek;
  const daysSince = (currentDay - targetDay + DAYS_IN_WEEK) % DAYS_IN_WEEK;
  const offset = daysSince === 0 ? DAYS_IN_WEEK : daysSince;

  return today.subtract({ days: offset });
}

/**
 * Resolve keyword to a ZonedDateTime.
 * Supports: yesterday, tomorrow, today, now, noon,
 * eom/bom/eoy/boy and their long forms.
 */
export function resolveKeyword(
  keyword: string,
  today: Temporal.PlainDate,
  timeZone: string
): Temporal.ZonedDateTime | undefined {
  switch (keyword.toLowerCase()) {
    case 'yesterday':
      return today.subtract({ days: 1 }).toZonedDateTime(timeZone);
    case 'tomorrow':
    case 'tom':
      return today.add({ days: 1 }).toZonedDateTime(timeZone);
    case 'today':
    case 'now':
      return today.toZonedDateTime(timeZone);
    case 'noon':
    case 'midday':
      return today.toZonedDateTime({ timeZone, plainTime: new Temporal.PlainTime(12) });
    case 'midnight':
      return today.toZonedDateTime(timeZone);
    case 'eom':
    case 'end of month':
    case 'end-of-month':
      return Temporal.PlainDate.from({
        year: today.year,
        month: today.month,
        day: today.daysInMonth,
      }).toZonedDateTime(timeZone);
    case 'bom':
    case 'som':
    case 'beginning of month':
    case 'start of month':
    case 'start-of-month': {
      // 1st of current month; if past, next month
      const bomDate = Temporal.PlainDate.from({
        year: today.year,
        month: today.month,
        day: 1,
      });
      if (Temporal.PlainDate.compare(bomDate, today) < 0) {
        const next = bomDate.add({ months: 1 });
        return next.toZonedDateTime(timeZone);
      }
      return bomDate.toZonedDateTime(timeZone);
    }
    case 'eoy':
    case 'end of year':
    case 'end-of-year':
      return Temporal.PlainDate.from({
        year: today.year,
        month: 12,
        day: 31,
      }).toZonedDateTime(timeZone);
    case 'boy':
    case 'soy':
    case 'beginning of year':
    case 'start of year':
    case 'start-of-year': {
      // Jan 1 of current year; if past, next year
      const boyDate = Temporal.PlainDate.from({
        year: today.year,
        month: 1,
        day: 1,
      });
      if (Temporal.PlainDate.compare(boyDate, today) < 0) {
        return Temporal.PlainDate.from({
          year: today.year + 1,
          month: 1,
          day: 1,
        }).toZonedDateTime(timeZone);
      }
      return boyDate.toZonedDateTime(timeZone);
    }
    case 'eoq':
    case 'end of quarter':
    case 'end-of-quarter': {
      const quarter = Math.ceil(today.month / 3);
      const end = QUARTER_END.get(quarter);
      if (isNil(end)) {
        return undefined;
      }
      return Temporal.PlainDate.from({
        year: today.year,
        month: end.month,
        day: end.day,
      }).toZonedDateTime(timeZone);
    }
    default:
      return undefined;
  }
}

/**
 * Resolve a month name to the 1st of the nearest future occurrence.
 * If the month hasn't occurred yet this year, use this year.
 * If the month has already passed, use next year.
 */
export function resolveMonthName(
  monthName: string,
  today: Temporal.PlainDate
): Temporal.PlainDate | undefined {
  const month = MONTH_MAP.get(monthName.toLowerCase());

  if (isNil(month)) {
    return undefined;
  }

  const year =
    month > today.month || (month === today.month && today.day === 1) ? today.year : today.year + 1;

  return Temporal.PlainDate.from({ year, month, day: 1 });
}

/**
 * Resolve a month name + year to the 1st of that month.
 */
export function resolveMonthYear(monthName: string, year: number): Temporal.PlainDate | undefined {
  const month = MONTH_MAP.get(monthName.toLowerCase());

  if (isNil(month)) {
    return undefined;
  }

  try {
    return Temporal.PlainDate.from({ year, month, day: 1 });
  } catch {
    return undefined;
  }
}

/**
 * Resolve a quarter reference to the start of that quarter.
 */
export function resolveQuarter(quarter: number, year: number): Temporal.PlainDate | undefined {
  const startMonth = QUARTER_START_MONTH.get(quarter);

  if (isNil(startMonth)) {
    return undefined;
  }

  try {
    return Temporal.PlainDate.from({ year, month: startMonth, day: 1 });
  } catch {
    return undefined;
  }
}

/**
 * Apply an offset (days, weeks, months, years) to a date.
 */
export function applyOffset(
  today: Temporal.PlainDate,
  amount: number,
  unit: string,
  direction: 1 | -1
): Temporal.PlainDate {
  const signedAmount = amount * direction;
  const duration = unitToDuration(unit, signedAmount);

  if (signedAmount >= 0) {
    return today.add(duration);
  }

  return today.subtract(negateDuration(duration));
}

/**
 * Try parsing a date string in common numeric formats:
 * - ISO: 2021-01-29
 * - ISO datetime: 2021-01-29T14:30
 * - Slash: DD/MM/YYYY
 * - Dot: DD.MM.YYYY
 * - Dash: DD-MM-YYYY (when first segment > 12)
 */
export function parseDirectDate(
  input: string,
  timeZone: string
): Temporal.ZonedDateTime | undefined {
  try {
    if (ISO_DATETIME_REGEX.test(input)) {
      return Temporal.ZonedDateTime.from(`${input}[${timeZone}]`);
    }

    if (ISO_DATE_REGEX.test(input)) {
      return Temporal.PlainDate.from(input).toZonedDateTime(timeZone);
    }

    const slashMatch = SLASH_DATE_REGEX.exec(input);
    if (!isNil(slashMatch)) {
      return parseDDMMYYYY(slashMatch[1], slashMatch[2], slashMatch[3], timeZone);
    }

    const dotMatch = DOT_DATE_REGEX.exec(input);
    if (!isNil(dotMatch)) {
      return parseDDMMYYYY(dotMatch[1], dotMatch[2], dotMatch[3], timeZone);
    }

    const dashMatch = DASH_DATE_DD_MM_YYYY_REGEX.exec(input);
    if (!isNil(dashMatch)) {
      return parseDDMMYYYY(dashMatch[1], dashMatch[2], dashMatch[3], timeZone);
    }
  } catch {
    return undefined;
  }

  return undefined;
}

/**
 * Compose a full parsing pipeline from individual resolvers.
 * Returns a function that tries each parser in priority order:
 *
 * 1. ISO dates (2025-01-15, 2025-01-15T14:30)
 * 2. Keywords (today, tomorrow, eom, boy, eoq, ...)
 * 3. Offset expressions (+3d, -1w, +2m)
 * 4. Duration shorthand (3w, 1d, 1m, 1y — always forward)
 * 5. Relative expressions (in 3 days, 2 weeks ago, next/last weekday)
 * 6. Full dates with month names (15 jan 2025, 15 jan 27, jan 15, 2025)
 * 7. Numeric dates with spaces (15 06 27, 15 06 2027)
 * 8. Quarter references (Q1 2025, 1Q25)
 * 9. Month + year (jan 2027, 2027 jan, 01/2027, 2027-01)
 * 10. Weekday names (mon, tuesday)
 * 11. Partial dates with month name (15 jan, jan 15, jan 15th)
 * 12. Ordinal day of current month (15th, the 1st)
 * 13. Numeric dates (DD/MM/YYYY, DD.MM.YYYY)
 * 14. Month name only (jan, february)
 */
export function createDateTimeParser(options: {
  today: Temporal.PlainDate;
  timeZone: string;
  getNextBusinessTime?: (date: Temporal.ZonedDateTime) => Temporal.ZonedDateTime;
}): (input: string) => DateTimeParseResult {
  const { today, timeZone, getNextBusinessTime } = options;

  function snap(date: Temporal.ZonedDateTime): Temporal.ZonedDateTime {
    return maybeSnapToBusinessTime(date, getNextBusinessTime);
  }

  function toZDT(date: Temporal.PlainDate): Temporal.ZonedDateTime {
    return date.toZonedDateTime(timeZone);
  }

  function parseDateOnly(trimmed: string): Temporal.ZonedDateTime | undefined {
    // 1. ISO dates (highest priority, unambiguous)
    const isoResult = tryParseISO(trimmed, timeZone);
    if (!isNil(isoResult)) {
      return isoResult;
    }

    // 2. Keywords (today, tomorrow, eom, boy, etc.)
    const keywordResult = resolveKeyword(trimmed, today, timeZone);
    if (!isNil(keywordResult)) {
      return keywordResult;
    }

    // 3. Offset expressions: +3d, -1w, +2m, +1y
    const offsetMatch = OFFSET_REGEX.exec(trimmed);
    if (!isNil(offsetMatch)) {
      const direction = offsetMatch[1] === '+' ? 1 : -1;
      return toZDT(applyOffset(today, Number(offsetMatch[2]), offsetMatch[3], direction));
    }

    // 4. Duration shorthand: 3w, 1d, 1m, 1y (always forward from today)
    const durationMatch = DURATION_REGEX.exec(trimmed);
    if (!isNil(durationMatch)) {
      return toZDT(applyOffset(today, Number(durationMatch[1]), durationMatch[2], 1));
    }

    // 5a. "in N days/weeks/months/years"
    const inMatch = IN_N_UNITS_REGEX.exec(trimmed);
    if (!isNil(inMatch)) {
      return toZDT(applyOffset(today, Number(inMatch[1]), inMatch[2][0], 1));
    }

    // 5b. "N days/weeks/months/years ago"
    const agoMatch = N_UNITS_AGO_REGEX.exec(trimmed);
    if (!isNil(agoMatch)) {
      return toZDT(applyOffset(today, Number(agoMatch[1]), agoMatch[2][0], -1));
    }

    // 5c. "next/last weekday"
    const nextLastMatch = NEXT_LAST_WEEKDAY_REGEX.exec(trimmed);
    if (!isNil(nextLastMatch)) {
      const direction = nextLastMatch[1].toLowerCase();
      const dayName = nextLastMatch[2].toLowerCase();
      const result =
        direction === 'next'
          ? resolveNextWeekday(dayName, today)
          : resolvePreviousWeekday(dayName, today);
      if (!isNil(result)) {
        return toZDT(result);
      }
    }

    // 6a. Full date: "15 jan 2025", "15th january 2025"
    const dayMonthYearMatch = DAY_MONTH_YEAR_REGEX.exec(trimmed);
    if (!isNil(dayMonthYearMatch)) {
      const result = tryBuildDate(
        Number(dayMonthYearMatch[1]),
        dayMonthYearMatch[2],
        normalizeYear(dayMonthYearMatch[3])
      );
      if (!isNil(result)) {
        return toZDT(result);
      }
    }

    // 6b. Full date: "jan 15 2025", "january 15th, 2025"
    const monthDayYearMatch = MONTH_DAY_YEAR_REGEX.exec(trimmed);
    if (!isNil(monthDayYearMatch)) {
      const result = tryBuildDate(
        Number(monthDayYearMatch[2]),
        monthDayYearMatch[1],
        normalizeYear(monthDayYearMatch[3])
      );
      if (!isNil(result)) {
        return toZDT(result);
      }
    }

    // 7. Numeric date with spaces: "15 06 27", "15 06 2027" (DD MM YY/YYYY)
    const numericSpaceMatch = NUMERIC_SPACE_DATE_REGEX.exec(trimmed);
    if (!isNil(numericSpaceMatch)) {
      const result = tryBuildPlainDate(
        normalizeYear(numericSpaceMatch[3]),
        Number(numericSpaceMatch[2]),
        Number(numericSpaceMatch[1])
      );
      if (!isNil(result)) {
        return toZDT(result);
      }
    }

    // 8a. Quarter: "Q1", "Q2 2025", "Q1/2025"
    const quarterQMatch = QUARTER_Q_REGEX.exec(trimmed);
    if (!isNil(quarterQMatch)) {
      const quarter = Number(quarterQMatch[1]);
      const hasExplicitYear = !isNil(quarterQMatch[2]);
      const year = hasExplicitYear ? normalizeYear(quarterQMatch[2]) : today.year;
      const result = resolveQuarter(quarter, year);
      if (!isNil(result)) {
        if (!hasExplicitYear && Temporal.PlainDate.compare(result, today) < 0) {
          const futureResult = resolveQuarter(quarter, today.year + 1);
          if (!isNil(futureResult)) {
            return toZDT(futureResult);
          }
        }
        return toZDT(result);
      }
    }

    // 8b. Quarter: "1Q25", "1Q2025"
    const quarterNQMatch = QUARTER_NQ_REGEX.exec(trimmed);
    if (!isNil(quarterNQMatch)) {
      const quarter = Number(quarterNQMatch[1]);
      const year = normalizeYear(quarterNQMatch[2]);
      const result = resolveQuarter(quarter, year);
      if (!isNil(result)) {
        return toZDT(result);
      }
    }

    // 9a. Month + year: "jan 2027", "january '27"
    const monthYearMatch = MONTH_YEAR_REGEX.exec(trimmed);
    if (!isNil(monthYearMatch)) {
      const yearStr = monthYearMatch[2] ?? monthYearMatch[3];
      const result = resolveMonthYear(monthYearMatch[1], normalizeYear(yearStr));
      if (!isNil(result)) {
        return toZDT(result);
      }
    }

    // 9b. Year + month: "2027 jan"
    const yearMonthMatch = YEAR_MONTH_REGEX.exec(trimmed);
    if (!isNil(yearMonthMatch)) {
      const result = resolveMonthYear(yearMonthMatch[2], Number(yearMonthMatch[1]));
      if (!isNil(result)) {
        return toZDT(result);
      }
    }

    // 9c. ISO month: "2027-01"
    const isoMonthMatch = ISO_MONTH_REGEX.exec(trimmed);
    if (!isNil(isoMonthMatch)) {
      const result = tryBuildPlainDate(Number(isoMonthMatch[1]), Number(isoMonthMatch[2]), 1);
      if (!isNil(result)) {
        return toZDT(result);
      }
    }

    // 9d. Slash month: "01/2027"
    const slashMonthMatch = SLASH_MONTH_REGEX.exec(trimmed);
    if (!isNil(slashMonthMatch)) {
      const result = tryBuildPlainDate(Number(slashMonthMatch[2]), Number(slashMonthMatch[1]), 1);
      if (!isNil(result)) {
        return toZDT(result);
      }
    }

    // 10. Weekday names (mon, tuesday)
    const weekdayResult = resolveNextWeekday(trimmed, today);
    if (!isNil(weekdayResult)) {
      return toZDT(weekdayResult);
    }

    // 11a. Partial date: "15 jan", "15th january"
    const dayMonthMatch = DAY_MONTH_REGEX.exec(trimmed);
    if (!isNil(dayMonthMatch)) {
      const result = resolvePartialDayMonth(Number(dayMonthMatch[1]), dayMonthMatch[2], today);
      if (!isNil(result)) {
        return toZDT(result);
      }
    }

    // 11b. Partial date: "jan 15", "january 15th"
    const monthDayMatch = MONTH_DAY_REGEX.exec(trimmed);
    if (!isNil(monthDayMatch)) {
      const result = resolvePartialDayMonth(Number(monthDayMatch[2]), monthDayMatch[1], today);
      if (!isNil(result)) {
        return toZDT(result);
      }
    }

    // 12. Ordinal day: "15th", "the 1st" — nearest future occurrence
    const ordinalMatch = ORDINAL_DAY_REGEX.exec(trimmed);
    if (!isNil(ordinalMatch)) {
      const result = resolveOrdinalDay(Number(ordinalMatch[1]), today);
      if (!isNil(result)) {
        return toZDT(result);
      }
    }

    // 13. Numeric dates (DD/MM/YYYY, DD.MM.YYYY, DD-MM-YYYY)
    const directResult = parseDirectDate(trimmed, timeZone);
    if (!isNil(directResult)) {
      return directResult;
    }

    // 14. Month name only (jan, february)
    const monthOnlyMatch = MONTH_NAME_REGEX.exec(trimmed);
    if (!isNil(monthOnlyMatch)) {
      const result = resolveMonthName(monthOnlyMatch[1], today);
      if (!isNil(result)) {
        return toZDT(result);
      }
    }

    return undefined;
  }

  return function parseDateTimeInput(input: string): DateTimeParseResult {
    const trimmed = input.trim();

    if (trimmed.length === 0) {
      return { success: false, reason: 'Empty input' };
    }

    // Try standalone time: "13:00", "9:30:45", "9am", "5:30pm"
    const standaloneTime = parseStandaloneTime(trimmed);
    if (!isNil(standaloneTime)) {
      const zdt = today.toZonedDateTime({ timeZone, plainTime: standaloneTime });
      return { success: true, value: snap(zdt) };
    }

    // Try to split time suffix from input: "tom 13:00", "15 jan 2025 9:30am"
    const split = splitTimeSuffix(trimmed);
    if (!isNil(split)) {
      const dateResult = parseDateOnly(split.datePart);
      if (!isNil(dateResult)) {
        const withTime = applyTimeToZDT(dateResult, split.time);
        return { success: true, value: snap(withTime) };
      }
    }

    // No time suffix — parse as date-only
    const dateResult = parseDateOnly(trimmed);
    if (!isNil(dateResult)) {
      return { success: true, value: snap(dateResult) };
    }

    return { success: false, reason: `Cannot parse "${trimmed}"` };
  };
}

// ── Time parsing helpers ──────────────────────────────────────────────

/** Parse a standalone time expression: "13:00", "9:30:45.123", "9am", "5:30pm" */
export function parseStandaloneTime(input: string): Temporal.PlainTime | undefined {
  // 24h format: "13:00", "9:30:45", "13:00:45.123"
  const timeMatch = STANDALONE_TIME_REGEX.exec(input);
  if (!isNil(timeMatch)) {
    return buildPlainTime(
      Number(timeMatch[1]),
      Number(timeMatch[2]),
      isNil(timeMatch[3]) ? 0 : Number(timeMatch[3]),
      isNil(timeMatch[4]) ? 0 : normalizeMilliseconds(timeMatch[4])
    );
  }

  // AM/PM: "9am", "2pm", "5:30pm", "11:30:00am"
  const ampmMatch = AMPM_TIME_REGEX.exec(input);
  if (!isNil(ampmMatch)) {
    const hour = convertAmPmHour(Number(ampmMatch[1]), ampmMatch[4]);
    if (isNil(hour)) {
      return undefined;
    }
    return buildPlainTime(
      hour,
      isNil(ampmMatch[2]) ? 0 : Number(ampmMatch[2]),
      isNil(ampmMatch[3]) ? 0 : Number(ampmMatch[3]),
      0
    );
  }

  return undefined;
}

/**
 * Try to split a time suffix from the end of a combined date+time expression.
 * Returns the date part and parsed time, or undefined if no time suffix found.
 */
function splitTimeSuffix(
  input: string
): { datePart: string; time: Temporal.PlainTime } | undefined {
  // Try 24h suffix: "tom 13:00", "15 jan 2025 9:30:45.123"
  const timeMatch = TIME_SUFFIX_REGEX.exec(input);
  if (!isNil(timeMatch)) {
    const time = buildPlainTime(
      Number(timeMatch[1]),
      Number(timeMatch[2]),
      isNil(timeMatch[3]) ? 0 : Number(timeMatch[3]),
      isNil(timeMatch[4]) ? 0 : normalizeMilliseconds(timeMatch[4])
    );
    if (!isNil(time)) {
      return { datePart: input.slice(0, timeMatch.index).trim(), time };
    }
  }

  // Try AM/PM suffix: "tom 9am", "15 jan 5:30pm"
  const ampmMatch = AMPM_SUFFIX_REGEX.exec(input);
  if (!isNil(ampmMatch)) {
    const hour = convertAmPmHour(Number(ampmMatch[1]), ampmMatch[4]);
    if (!isNil(hour)) {
      const time = buildPlainTime(
        hour,
        isNil(ampmMatch[2]) ? 0 : Number(ampmMatch[2]),
        isNil(ampmMatch[3]) ? 0 : Number(ampmMatch[3]),
        0
      );
      if (!isNil(time)) {
        return { datePart: input.slice(0, ampmMatch.index).trim(), time };
      }
    }
  }

  return undefined;
}

/** Apply a PlainTime to a ZonedDateTime, replacing its time component. */
function applyTimeToZDT(
  zdt: Temporal.ZonedDateTime,
  time: Temporal.PlainTime
): Temporal.ZonedDateTime {
  return zdt.toPlainDate().toZonedDateTime({
    timeZone: zdt.timeZoneId,
    plainTime: time,
  });
}

function buildPlainTime(
  hour: number,
  minute: number,
  second: number,
  millisecond: number
): Temporal.PlainTime | undefined {
  try {
    return new Temporal.PlainTime(hour, minute, second, millisecond);
  } catch {
    return undefined;
  }
}

/** Convert 12h hour + am/pm to 24h hour. Returns undefined for invalid hours. */
function convertAmPmHour(hour: number, ampm: string): number | undefined {
  if (hour < 1 || hour > 12) {
    return undefined;
  }

  const isPm = ampm.toLowerCase() === 'pm';

  if (hour === 12) {
    return isPm ? 12 : 0;
  }

  return isPm ? hour + 12 : hour;
}

/** Normalize milliseconds string: "1" → 100, "12" → 120, "123" → 123 */
function normalizeMilliseconds(ms: string): number {
  return Number(ms.padEnd(3, '0'));
}

// ── Private helpers ───────────────────────────────────────────────────

function maybeSnapToBusinessTime(
  date: Temporal.ZonedDateTime,
  getNextBusinessTime?: (date: Temporal.ZonedDateTime) => Temporal.ZonedDateTime
): Temporal.ZonedDateTime {
  if (isNil(getNextBusinessTime)) {
    return date;
  }

  return getNextBusinessTime(date);
}

function tryParseISO(input: string, timeZone: string): Temporal.ZonedDateTime | undefined {
  try {
    if (ISO_DATETIME_REGEX.test(input)) {
      return Temporal.ZonedDateTime.from(`${input}[${timeZone}]`);
    }

    if (ISO_DATE_REGEX.test(input)) {
      return Temporal.PlainDate.from(input).toZonedDateTime(timeZone);
    }
  } catch {
    return undefined;
  }

  return undefined;
}

/** Normalize a 2 or 4 digit year string to a full year number. */
function normalizeYear(yearStr: string): number {
  const n = Number(yearStr);

  if (yearStr.length <= 2) {
    return n < 50 ? 2000 + n : 1900 + n;
  }

  return n;
}

function parseDDMMYYYY(
  dayStr: string,
  monthStr: string,
  yearStr: string,
  timeZone: string
): Temporal.ZonedDateTime | undefined {
  try {
    return Temporal.PlainDate.from({
      year: Number(yearStr),
      month: Number(monthStr),
      day: Number(dayStr),
    }).toZonedDateTime(timeZone);
  } catch {
    return undefined;
  }
}

function tryBuildPlainDate(
  year: number,
  month: number,
  day: number
): Temporal.PlainDate | undefined {
  try {
    return Temporal.PlainDate.from({ year, month, day });
  } catch {
    return undefined;
  }
}

function tryBuildDate(
  day: number,
  monthName: string,
  year: number
): Temporal.PlainDate | undefined {
  const month = MONTH_MAP.get(monthName.toLowerCase());

  if (isNil(month)) {
    return undefined;
  }

  return tryBuildPlainDate(year, month, day);
}

/**
 * Resolve a day + month without year to the nearest future occurrence.
 * If the date hasn't occurred yet this year, use this year.
 * If it has already passed, use next year.
 */
function resolvePartialDayMonth(
  day: number,
  monthName: string,
  today: Temporal.PlainDate
): Temporal.PlainDate | undefined {
  const month = MONTH_MAP.get(monthName.toLowerCase());

  if (isNil(month)) {
    return undefined;
  }

  const thisYear = tryBuildPlainDate(today.year, month, day);

  if (!isNil(thisYear) && Temporal.PlainDate.compare(thisYear, today) >= 0) {
    return thisYear;
  }

  return tryBuildPlainDate(today.year + 1, month, day);
}

/**
 * Resolve an ordinal day (e.g. "the 1st", "15th") to the nearest future occurrence.
 * If the day hasn't passed this month, use current month.
 * Otherwise, use next month.
 */
function resolveOrdinalDay(day: number, today: Temporal.PlainDate): Temporal.PlainDate | undefined {
  const thisMonth = tryBuildPlainDate(today.year, today.month, day);

  if (!isNil(thisMonth) && Temporal.PlainDate.compare(thisMonth, today) >= 0) {
    return thisMonth;
  }

  // Try next month
  const nextMonth = today.month === 12 ? 1 : today.month + 1;
  const nextYear = today.month === 12 ? today.year + 1 : today.year;

  return tryBuildPlainDate(nextYear, nextMonth, day);
}

function unitToDuration(unit: string, amount: number): Temporal.DurationLike {
  const absAmount = Math.abs(amount);

  switch (unit.toLowerCase()) {
    case 'd':
    case 'day':
      return { days: absAmount };
    case 'w':
    case 'week':
      return { weeks: absAmount };
    case 'm':
    case 'month':
      return { months: absAmount };
    case 'y':
    case 'year':
      return { years: absAmount };
    default:
      return { days: absAmount };
  }
}

function negateDuration(duration: Temporal.DurationLike): Temporal.DurationLike {
  return {
    years: duration.years,
    months: duration.months,
    weeks: duration.weeks,
    days: duration.days,
  };
}
