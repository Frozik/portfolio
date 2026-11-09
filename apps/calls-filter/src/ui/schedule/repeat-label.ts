import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Temporal } from 'temporal-polyfill';

import type { TRepeatPreset } from '../../contexts/policy/application/repeat-presets';
import type { TWeekday } from '../../contexts/policy/domain/schedule';
import type { ITexts } from '../../texts/texts';

/** A repeat menu item as Google Calendar words it, the start date filling in the day. */
export function presetLabel(
  texts: ITexts,
  preset: Exclude<TRepeatPreset, 'custom'>,
  start: Temporal.PlainDate
): string {
  switch (preset) {
    case 'once':
      return texts.schedule.once;
    case 'daily':
      return texts.schedule.daily;
    case 'weekdays':
      return texts.schedule.weekdays;
    case 'weekends':
      return texts.schedule.weekends;
    case 'weekly':
      return texts.schedule.weeklyOn(texts.format.weekdayShort(start.dayOfWeek as TWeekday));
    case 'monthly':
      return texts.schedule.monthlyOn(start.day);
    case 'yearly':
      return texts.schedule.yearlyOn(texts.format.dayMonth(start.day, start.month));
    default:
      return assertNever(preset);
  }
}
