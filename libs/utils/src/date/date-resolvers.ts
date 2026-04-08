import { Temporal } from '@js-temporal/polyfill';
import { isNil } from 'lodash-es';
import {
  LAST_DAY_OF_DECEMBER,
  LAST_MONTH_OF_YEAR,
  MIN_4_DIGIT_YEAR,
  NOON_HOUR,
  QUARTER_DIVISOR,
} from './constants';
import { MONTH_MAP, QUARTER_END } from './lookups';
import {
  applyOffsetSlots,
  dateToSlots,
  resolveNextWeekdaySlots,
  resolvePreviousWeekdaySlots,
  resolveQuarterSlots,
  slotsToPlainDate,
  tryBuildDateSlots,
} from './slot-utils';
import type { ISlotMap, IToken } from './token-types';
import { ETokenKind } from './token-types';

export function resolveKeywordToSlots(
  keyword: string,
  today: Temporal.PlainDate
): ISlotMap | undefined {
  switch (keyword.toLowerCase()) {
    case 'yesterday': {
      const d = today.subtract({ days: 1 });
      return { day: d.day, month: d.month, year: d.year };
    }
    case 'tomorrow':
    case 'tom': {
      const d = today.add({ days: 1 });
      return { day: d.day, month: d.month, year: d.year };
    }
    case 'today':
    case 'now':
      return { day: today.day, month: today.month, year: today.year };
    case 'noon':
    case 'midday':
      return {
        day: today.day,
        month: today.month,
        year: today.year,
        hour: NOON_HOUR,
        minute: 0,
        second: 0,
        ms: 0,
      };
    case 'midnight':
      return {
        day: today.day,
        month: today.month,
        year: today.year,
        hour: 0,
        minute: 0,
        second: 0,
        ms: 0,
      };
    case 'eom':
    case 'end of month':
    case 'end-of-month':
      return { day: today.daysInMonth, month: today.month, year: today.year };
    case 'bom':
    case 'som':
    case 'beginning of month':
    case 'start of month':
    case 'start-of-month': {
      const bomDate = Temporal.PlainDate.from({
        year: today.year,
        month: today.month,
        day: 1,
      });
      if (Temporal.PlainDate.compare(bomDate, today) < 0) {
        const next = bomDate.add({ months: 1 });
        return { day: next.day, month: next.month, year: next.year };
      }
      return { day: bomDate.day, month: bomDate.month, year: bomDate.year };
    }
    case 'eoy':
    case 'end of year':
    case 'end-of-year':
      return { day: LAST_DAY_OF_DECEMBER, month: LAST_MONTH_OF_YEAR, year: today.year };
    case 'boy':
    case 'soy':
    case 'beginning of year':
    case 'start of year':
    case 'start-of-year': {
      const boyDate = Temporal.PlainDate.from({
        year: today.year,
        month: 1,
        day: 1,
      });
      if (Temporal.PlainDate.compare(boyDate, today) < 0) {
        return { day: 1, month: 1, year: today.year + 1 };
      }
      return { day: boyDate.day, month: boyDate.month, year: boyDate.year };
    }
    case 'eoq':
    case 'end of quarter':
    case 'end-of-quarter': {
      const quarter = Math.ceil(today.month / QUARTER_DIVISOR);
      const end = QUARTER_END.get(quarter);
      if (isNil(end)) {
        return undefined;
      }
      return { day: end.day, month: end.month, year: today.year };
    }
    default:
      return undefined;
  }
}

export function resolveNextWeekdayToSlots(
  dayName: string,
  today: Temporal.PlainDate
): ISlotMap | undefined {
  return resolveNextWeekdaySlots(dayName, today);
}

export function resolvePreviousWeekdayToSlots(
  dayName: string,
  today: Temporal.PlainDate
): ISlotMap | undefined {
  return resolvePreviousWeekdaySlots(dayName, today);
}

export { resolveMonthNameToSlots } from './slot-utils';

export function resolveMonthYearToSlots(monthName: string, year: number): ISlotMap | undefined {
  const month = MONTH_MAP.get(monthName.toLowerCase());

  if (isNil(month)) {
    return undefined;
  }

  return tryBuildDateSlots(year, month, 1);
}

export function resolveQuarterToSlots(quarter: number, year: number): ISlotMap | undefined {
  return resolveQuarterSlots(quarter, year);
}

export function applyOffsetToSlots(
  today: Temporal.PlainDate,
  amount: number,
  unit: string,
  direction: 1 | -1
): ISlotMap {
  return applyOffsetSlots(today, amount, unit, direction);
}

export function parseDirectDateToSlots(input: string, timeZone: string): ISlotMap | undefined {
  const isoResult = tryParseISOSlots(input, timeZone);
  if (!isNil(isoResult)) {
    return isoResult;
  }

  const directResult = tryParseDirectDateSlots(input);
  if (!isNil(directResult)) {
    return directResult;
  }

  return undefined;
}

export function parseStandaloneTimeToSlots(input: string): ISlotMap | undefined {
  return tryParseStandaloneTimeSlots(input);
}

export function resolveKeywordToDateSlots(
  token: IToken,
  today: Temporal.PlainDate
): ISlotMap | undefined {
  const keyword = token.raw.toLowerCase();

  if (!isNil(token.extra) && token.extra.startsWith('weekday:')) {
    const dayName = token.extra.slice('weekday:'.length);
    const direction = token.value;
    return direction === 1
      ? resolveNextWeekdaySlots(dayName, today)
      : resolvePreviousWeekdaySlots(dayName, today);
  }

  switch (keyword) {
    case 'yesterday':
      return dateToSlots(today.subtract({ days: 1 }));
    case 'tomorrow':
    case 'tom':
      return dateToSlots(today.add({ days: 1 }));
    case 'today':
    case 'now':
      return dateToSlots(today);
    default:
      return undefined;
  }
}

export function resolveTimeKeywordToSlots(keyword: string): ISlotMap | undefined {
  switch (keyword) {
    case 'noon':
    case 'midday':
      return { hour: NOON_HOUR, minute: 0, second: 0, ms: 0 };
    case 'midnight':
      return { hour: 0, minute: 0, second: 0, ms: 0 };
    default:
      return undefined;
  }
}

export function resolveBoundaryKeywordToSlots(
  keyword: string,
  today: Temporal.PlainDate
): ISlotMap | undefined {
  switch (keyword) {
    case 'eom':
    case 'end of month':
    case 'end-of-month':
      return { year: today.year, month: today.month, day: today.daysInMonth };
    case 'bom':
    case 'som':
    case 'beginning of month':
    case 'start of month':
    case 'start-of-month': {
      const bomDate = Temporal.PlainDate.from({
        year: today.year,
        month: today.month,
        day: 1,
      });
      if (Temporal.PlainDate.compare(bomDate, today) < 0) {
        const next = bomDate.add({ months: 1 });
        return dateToSlots(next);
      }
      return dateToSlots(bomDate);
    }
    case 'eoy':
    case 'end of year':
    case 'end-of-year':
      return { year: today.year, month: LAST_MONTH_OF_YEAR, day: LAST_DAY_OF_DECEMBER };
    case 'boy':
    case 'soy':
    case 'beginning of year':
    case 'start of year':
    case 'start-of-year': {
      const boyDate = Temporal.PlainDate.from({
        year: today.year,
        month: 1,
        day: 1,
      });
      if (Temporal.PlainDate.compare(boyDate, today) < 0) {
        return { year: today.year + 1, month: 1, day: 1 };
      }
      return dateToSlots(boyDate);
    }
    case 'eoq':
    case 'end of quarter':
    case 'end-of-quarter': {
      const quarter = Math.ceil(today.month / QUARTER_DIVISOR);
      const endMonth = quarter * QUARTER_DIVISOR;
      const lastDay = Temporal.PlainDate.from({
        year: today.year,
        month: endMonth,
        day: 1,
      });
      return { year: today.year, month: endMonth, day: lastDay.daysInMonth };
    }
    default:
      return undefined;
  }
}

export function resolveQuarterFromToken(
  token: IToken,
  tokens: IToken[],
  today: Temporal.PlainDate
): Temporal.PlainDate | undefined {
  const quarter = token.value;

  const yearToken = tokens.find(
    t => t !== token && t.kind === ETokenKind.Number && t.value >= MIN_4_DIGIT_YEAR
  );

  if (!isNil(yearToken)) {
    const yqSlots = resolveQuarterSlots(quarter, yearToken.value);
    return isNil(yqSlots) ? undefined : slotsToPlainDate(yqSlots);
  }

  const rqSlots = resolveQuarterSlots(quarter, today.year);
  const rqDate = isNil(rqSlots) ? undefined : slotsToPlainDate(rqSlots);
  if (!isNil(rqDate) && Temporal.PlainDate.compare(rqDate, today) < 0) {
    const fqSlots = resolveQuarterSlots(quarter, today.year + 1);
    return isNil(fqSlots) ? undefined : slotsToPlainDate(fqSlots);
  }
  return rqDate;
}

export function tryResolveKeyword(
  keyword: string,
  today: Temporal.PlainDate,
  timeZone: string
): Temporal.ZonedDateTime | undefined {
  const lower = keyword.toLowerCase();

  switch (lower) {
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
      return today.toZonedDateTime({ timeZone, plainTime: new Temporal.PlainTime(NOON_HOUR) });
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
      const bomDate = Temporal.PlainDate.from({
        year: today.year,
        month: today.month,
        day: 1,
      });
      if (Temporal.PlainDate.compare(bomDate, today) < 0) {
        return bomDate.add({ months: 1 }).toZonedDateTime(timeZone);
      }
      return bomDate.toZonedDateTime(timeZone);
    }
    case 'eoy':
    case 'end of year':
    case 'end-of-year':
      return Temporal.PlainDate.from({
        year: today.year,
        month: LAST_MONTH_OF_YEAR,
        day: LAST_DAY_OF_DECEMBER,
      }).toZonedDateTime(timeZone);
    case 'boy':
    case 'soy':
    case 'beginning of year':
    case 'start of year':
    case 'start-of-year': {
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
      const quarter = Math.ceil(today.month / QUARTER_DIVISOR);
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

// Internal helpers used by parse-pipeline, re-exported from slot-utils
import {
  AMPM_TIME_REGEX,
  DASH_DATE_DD_MM_YYYY_REGEX,
  DOT_DATE_REGEX,
  ISO_DATE_REGEX,
  ISO_DATETIME_REGEX,
  SLASH_DATE_REGEX,
  STANDALONE_TIME_REGEX,
} from './patterns';
import {
  buildTimeSlots,
  convertAmPmHour,
  normalizeMilliseconds,
  parseDDMMYYYYSlots,
} from './slot-utils';

export function tryParseStandaloneTimeSlots(input: string): ISlotMap | undefined {
  const timeMatch = STANDALONE_TIME_REGEX.exec(input);
  if (!isNil(timeMatch)) {
    return buildTimeSlots(
      Number(timeMatch[1]),
      Number(timeMatch[2]),
      isNil(timeMatch[3]) ? 0 : Number(timeMatch[3]),
      isNil(timeMatch[4]) ? 0 : normalizeMilliseconds(timeMatch[4])
    );
  }

  const ampmMatch = AMPM_TIME_REGEX.exec(input);
  if (!isNil(ampmMatch)) {
    const hour = convertAmPmHour(Number(ampmMatch[1]), ampmMatch[4]);
    if (isNil(hour)) {
      return undefined;
    }
    return buildTimeSlots(
      hour,
      isNil(ampmMatch[2]) ? 0 : Number(ampmMatch[2]),
      isNil(ampmMatch[3]) ? 0 : Number(ampmMatch[3]),
      0
    );
  }

  return undefined;
}

export function tryParseISOSlots(input: string, timeZone: string): ISlotMap | undefined {
  try {
    if (ISO_DATETIME_REGEX.test(input)) {
      const zdt = Temporal.ZonedDateTime.from(`${input}[${timeZone}]`);
      return {
        year: zdt.year,
        month: zdt.month,
        day: zdt.day,
        hour: zdt.hour,
        minute: zdt.minute,
        second: zdt.second,
        ms: zdt.millisecond,
      };
    }

    if (ISO_DATE_REGEX.test(input)) {
      const date = Temporal.PlainDate.from(input);
      return dateToSlots(date);
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export function tryParseDirectDateSlots(input: string): ISlotMap | undefined {
  const slashMatch = SLASH_DATE_REGEX.exec(input);
  if (!isNil(slashMatch)) {
    return parseDDMMYYYYSlots(slashMatch[1], slashMatch[2], slashMatch[3]);
  }

  const dotMatch = DOT_DATE_REGEX.exec(input);
  if (!isNil(dotMatch)) {
    return parseDDMMYYYYSlots(dotMatch[1], dotMatch[2], dotMatch[3]);
  }

  const dashMatch = DASH_DATE_DD_MM_YYYY_REGEX.exec(input);
  if (!isNil(dashMatch)) {
    return parseDDMMYYYYSlots(dashMatch[1], dashMatch[2], dashMatch[3]);
  }

  return undefined;
}
