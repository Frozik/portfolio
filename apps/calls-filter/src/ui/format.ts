import type { Temporal } from 'temporal-polyfill';

import type { IActionNow } from '../contexts/policy/domain/action-now';
import { plainDateTimeOf } from '../contexts/policy/domain/floating-time';
import type { TWeekday } from '../contexts/policy/domain/schedule';
import type { ITexts } from '../texts/texts';

/** A moment the way a list says it: the time today, the weekday and date later. */
export function momentText(
  texts: ITexts,
  moment: Temporal.PlainDateTime,
  today: Temporal.PlainDate
): string {
  const time = texts.format.time(moment.hour, moment.minute);
  if (moment.toPlainDate().equals(today)) {
    return time;
  }
  return `${texts.format.weekdayShort(moment.dayOfWeek as TWeekday)} ${texts.format.dayMonth(moment.day, moment.month)}, ${time}`;
}

export function changeText(
  texts: ITexts,
  changesAt: IActionNow['changesAt'],
  zone: string,
  today: Temporal.PlainDate
): string | null {
  if (changesAt === null) {
    return null;
  }
  const local =
    changesAt.kind === 'instant'
      ? changesAt.at.toZonedDateTimeISO(zone).toPlainDateTime()
      : plainDateTimeOf(changesAt.at);
  return momentText(texts, local, today);
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
