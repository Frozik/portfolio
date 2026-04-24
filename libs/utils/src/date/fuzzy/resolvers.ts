import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

import {
  DAYS_IN_WEEK,
  MIN_4_DIGIT_YEAR,
  MONTHS_IN_YEAR,
  NOON_HOUR,
  QUARTER_DIVISOR,
} from './constants';
import { MONTH_MAP, QUARTER_START_MONTH, WEEKDAY_MAP } from './lookups';
import { dateToSlots, slotsToPlainDate, tryBuildDateSlots } from './slots';
import type { ISlotMap, IToken } from './types';
import { ETokenKind } from './types';

export function resolveNextWeekdaySlots(
  dayName: string,
  today: Temporal.PlainDate
): ISlotMap | undefined {
  const targetDay = WEEKDAY_MAP.get(dayName.toLowerCase());

  if (isNil(targetDay)) {
    return undefined;
  }

  const currentDay = today.dayOfWeek;
  const daysUntil = (targetDay - currentDay + DAYS_IN_WEEK) % DAYS_IN_WEEK;
  const offset = daysUntil === 0 ? DAYS_IN_WEEK : daysUntil;

  return dateToSlots(today.add({ days: offset }));
}

export function resolvePreviousWeekdaySlots(
  dayName: string,
  today: Temporal.PlainDate
): ISlotMap | undefined {
  const targetDay = WEEKDAY_MAP.get(dayName.toLowerCase());

  if (isNil(targetDay)) {
    return undefined;
  }

  const currentDay = today.dayOfWeek;
  const daysSince = (currentDay - targetDay + DAYS_IN_WEEK) % DAYS_IN_WEEK;
  const offset = daysSince === 0 ? DAYS_IN_WEEK : daysSince;

  return dateToSlots(today.subtract({ days: offset }));
}

export function resolvePartialDayMonthSlots(
  day: number,
  monthName: string,
  today: Temporal.PlainDate
): ISlotMap | undefined {
  const month = MONTH_MAP.get(monthName.toLowerCase());

  if (isNil(month)) {
    return undefined;
  }

  return resolvePartialDayMonthNumericSlots(day, month, today);
}

export function resolvePartialDayMonthNumericSlots(
  day: number,
  month: number,
  today: Temporal.PlainDate
): ISlotMap | undefined {
  const thisYear = tryBuildDateSlots(today.year, month, day);
  if (!isNil(thisYear)) {
    const thisYearDate = Temporal.PlainDate.from({
      year: today.year,
      month,
      day,
    });
    if (Temporal.PlainDate.compare(thisYearDate, today) >= 0) {
      return thisYear;
    }
  }
  return tryBuildDateSlots(today.year + 1, month, day);
}

export function resolveOrdinalDaySlots(
  day: number,
  today: Temporal.PlainDate
): ISlotMap | undefined {
  const thisMonth = tryBuildDateSlots(today.year, today.month, day);
  if (!isNil(thisMonth)) {
    const thisMonthDate = Temporal.PlainDate.from({
      year: today.year,
      month: today.month,
      day,
    });
    if (Temporal.PlainDate.compare(thisMonthDate, today) >= 0) {
      return thisMonth;
    }
  }
  const nextMonth = today.month === MONTHS_IN_YEAR ? 1 : today.month + 1;
  const nextYear = today.month === MONTHS_IN_YEAR ? today.year + 1 : today.year;
  return tryBuildDateSlots(nextYear, nextMonth, day);
}

export function resolveMonthNameToSlots(
  monthName: string,
  today: Temporal.PlainDate
): ISlotMap | undefined {
  const month = MONTH_MAP.get(monthName.toLowerCase());

  if (isNil(month)) {
    return undefined;
  }

  const year =
    month > today.month || (month === today.month && today.day === 1) ? today.year : today.year + 1;

  return { year, month, day: 1 };
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

export function applyOffsetSlots(
  today: Temporal.PlainDate,
  amount: number,
  unit: string,
  direction: 1 | -1
): ISlotMap {
  const signedAmount = amount * direction;
  const duration = unitToDuration(unit, signedAmount);

  const result = signedAmount >= 0 ? today.add(duration) : today.subtract(negateDuration(duration));

  return dateToSlots(result);
}

export function resolveQuarterSlots(quarter: number, year: number): ISlotMap | undefined {
  const startMonth = QUARTER_START_MONTH.get(quarter);

  if (isNil(startMonth)) {
    return undefined;
  }

  return tryBuildDateSlots(year, startMonth, 1);
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
      return { year: today.year, month: 12, day: 31 };
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
    candidate =>
      candidate !== token &&
      candidate.kind === ETokenKind.Number &&
      candidate.value >= MIN_4_DIGIT_YEAR
  );

  if (!isNil(yearToken)) {
    const yearQuarterSlots = resolveQuarterSlots(quarter, yearToken.value);
    return isNil(yearQuarterSlots) ? undefined : slotsToPlainDate(yearQuarterSlots);
  }

  const currentYearSlots = resolveQuarterSlots(quarter, today.year);
  const currentYearDate = isNil(currentYearSlots) ? undefined : slotsToPlainDate(currentYearSlots);
  if (!isNil(currentYearDate) && Temporal.PlainDate.compare(currentYearDate, today) < 0) {
    const nextYearSlots = resolveQuarterSlots(quarter, today.year + 1);
    return isNil(nextYearSlots) ? undefined : slotsToPlainDate(nextYearSlots);
  }
  return currentYearDate;
}
