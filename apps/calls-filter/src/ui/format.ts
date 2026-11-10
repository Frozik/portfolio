import type { Temporal } from 'temporal-polyfill';

import type { IActivityNow } from '../contexts/policy/domain/activity-now';
import { plainDateTimeOf } from '../contexts/policy/domain/floating-time';
import type { TWeekday } from '../contexts/policy/domain/schedule';
import type { ITexts } from '../texts/texts';

/** Past this many days ahead a weekday could mean two dates, so the date is named instead. */
const WEEKDAY_REACH_DAYS = 6;

/** A moment the way a list says it: the time today, the weekday in the coming week, else the date. */
export function momentText(
  texts: ITexts,
  moment: Temporal.PlainDateTime,
  today: Temporal.PlainDate
): string {
  const time = texts.format.time(moment.hour, moment.minute);
  const daysAhead = today.until(moment.toPlainDate()).days;
  if (daysAhead === 0) {
    return time;
  }
  if (daysAhead > 0 && daysAhead <= WEEKDAY_REACH_DAYS) {
    return `${texts.format.weekdayShort(moment.dayOfWeek as TWeekday)} ${time}`;
  }
  return `${texts.format.dayMonth(moment.day, moment.month)}, ${time}`;
}

export function changeText(
  texts: ITexts,
  changesAt: IActivityNow['changesAt'],
  today: Temporal.PlainDate
): string | null {
  return changesAt === null ? null : momentText(texts, plainDateTimeOf(changesAt), today);
}

export function dayText(
  texts: ITexts,
  date: Temporal.PlainDate,
  today: Temporal.PlainDate
): string {
  if (date.equals(today)) {
    return texts.common.today;
  }
  if (date.equals(today.subtract({ days: 1 }))) {
    return texts.common.yesterday;
  }
  return `${texts.format.weekdayShort(date.dayOfWeek as TWeekday)} ${texts.format.dayMonth(date.day, date.month)}`;
}
