import { assertNever } from '@frozik/utils/assert/assertNever';
import { Temporal } from 'temporal-polyfill';

import type { TFloatingMinute } from './floating-time';
import { floatingDateStart, floatingMinute, MINUTES_PER_DAY } from './floating-time';
import type { ISchedule, TScheduleTime } from './schedule';
import type { IWindow, TWindowSet } from './window-set';
import { normalizeWindows } from './window-set';

/** The windows one time of day makes on one date; a range whose end is before its start runs past midnight. */
export function timeWindow(date: Temporal.PlainDate, time: TScheduleTime): IWindow {
  const dayStart = floatingDateStart(date);
  switch (time.kind) {
    case 'all-day':
      return { from: dayStart, to: (dayStart + MINUTES_PER_DAY) as TFloatingMinute };
    case 'range': {
      const from = floatingMinute(date.toPlainDateTime(time.from));
      const endsNextDay = Temporal.PlainTime.compare(time.to, time.from) <= 0;
      const to = floatingMinute(
        (endsNextDay ? date.add({ days: 1 }) : date).toPlainDateTime(time.to)
      );
      return { from, to };
    }
    default:
      return assertNever(time);
  }
}

/** The windows of a schedule on the days its recurrence picked, less the dates it leaves out. */
export function scheduleWindows(
  schedule: ISchedule,
  occurrences: readonly Temporal.PlainDate[]
): TWindowSet {
  const skipped = new Set(schedule.exceptDates.map(date => date.toString()));
  return normalizeWindows(
    occurrences
      .filter(date => !skipped.has(date.toString()))
      .flatMap(date => schedule.times.map(time => timeWindow(date, time)))
  );
}
