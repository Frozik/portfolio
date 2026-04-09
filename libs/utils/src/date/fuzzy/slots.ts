import { Temporal } from '@js-temporal/polyfill';
import { isNil } from 'lodash-es';

import {
  MAX_AMBIGUOUS_HOUR,
  MS_PAD_LENGTH,
  NOON_HOUR,
  TWO_DIGIT_YEAR_BASE_HIGH,
  TWO_DIGIT_YEAR_BASE_LOW,
  TWO_DIGIT_YEAR_CUTOFF,
} from './constants';
import { MONTH_MAP } from './lookups';
import type { ISlotMap } from './types';

export function mergeSlots(base: ISlotMap, override: ISlotMap): ISlotMap {
  return { ...base, ...override };
}

export function dateToSlots(date: Temporal.PlainDate): ISlotMap {
  return { year: date.year, month: date.month, day: date.day };
}

export function slotsToPlainDate(slots: ISlotMap): Temporal.PlainDate | undefined {
  if (isNil(slots.year) || isNil(slots.month) || isNil(slots.day)) {
    return undefined;
  }
  try {
    return Temporal.PlainDate.from(
      { year: slots.year, month: slots.month, day: slots.day },
      { overflow: 'reject' }
    );
  } catch {
    return undefined;
  }
}

export function slotsToPlainTime(slots: ISlotMap): Temporal.PlainTime | undefined {
  if (isNil(slots.hour)) {
    return undefined;
  }
  try {
    return new Temporal.PlainTime(slots.hour, slots.minute ?? 0, slots.second ?? 0, slots.ms ?? 0);
  } catch {
    return undefined;
  }
}

export function applyTimeSlotsToZDT(
  zonedDateTime: Temporal.ZonedDateTime,
  timeSlots: ISlotMap
): Temporal.ZonedDateTime | undefined {
  const time = slotsToPlainTime(timeSlots);
  if (isNil(time)) {
    return undefined;
  }
  return zonedDateTime.withPlainTime(time);
}

export function normalizeYear(yearStr: string): number {
  const year = Number(yearStr);
  if (yearStr.length <= 2) {
    return year < TWO_DIGIT_YEAR_CUTOFF
      ? TWO_DIGIT_YEAR_BASE_LOW + year
      : TWO_DIGIT_YEAR_BASE_HIGH + year;
  }
  return year;
}

export function convertAmPmHour(hour: number, ampm: string): number | undefined {
  if (hour < 1 || hour > NOON_HOUR) {
    return undefined;
  }
  const isPm = ampm.toLowerCase() === 'pm';
  if (hour === NOON_HOUR) {
    return isPm ? NOON_HOUR : 0;
  }
  return isPm ? hour + NOON_HOUR : hour;
}

export function normalizeMilliseconds(milliseconds: string): number {
  return Number(milliseconds.padEnd(MS_PAD_LENGTH, '0'));
}

export function buildTimeSlots(
  hour: number,
  minute: number,
  second: number,
  millisecond: number
): ISlotMap | undefined {
  try {
    new Temporal.PlainTime(hour, minute, second, millisecond);
    return { hour, minute, second, ms: millisecond };
  } catch {
    return undefined;
  }
}

export function tryBuildDateSlots(year: number, month: number, day: number): ISlotMap | undefined {
  try {
    Temporal.PlainDate.from({ year, month, day }, { overflow: 'reject' });
    return { year, month, day };
  } catch {
    return undefined;
  }
}

export function tryBuildDateFromName(
  day: number,
  monthName: string,
  year: number
): ISlotMap | undefined {
  const month = MONTH_MAP.get(monthName.toLowerCase());

  if (isNil(month)) {
    return undefined;
  }

  return tryBuildDateSlots(year, month, day);
}

export function isAmbiguousHour(yearStr: string): boolean {
  return yearStr.length <= 2 && Number(yearStr) <= MAX_AMBIGUOUS_HOUR;
}

export function assembleZDT(
  slots: ISlotMap,
  today: Temporal.PlainDate,
  timeZone: string
): Temporal.ZonedDateTime | undefined {
  const year = slots.year ?? today.year;
  const month = slots.month ?? today.month;
  const day = slots.day ?? today.day;
  const hour = slots.hour ?? 0;
  const minute = slots.minute ?? 0;
  const second = slots.second ?? 0;
  const ms = slots.ms ?? 0;

  try {
    const date = Temporal.PlainDate.from({ year, month, day });
    const time = new Temporal.PlainTime(hour, minute, second, ms);
    return date.toZonedDateTime({ timeZone, plainTime: time });
  } catch {
    return undefined;
  }
}
