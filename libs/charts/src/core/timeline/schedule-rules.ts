import { assert } from '@frozik/utils/assert/assert';
import type { EDayOfWeek } from '@frozik/utils/date/constants';
import { uniq } from 'lodash-es';

import type { IResolvedBoundary } from './boundary';
import { momentOf, resolveBoundary } from './boundary';
import type { ITimeInterval } from './intervals';
import { unionOf } from './intervals';
import type { ISchedule, TScheduleEffect } from './schedule';

export interface IWeeklyRule {
  readonly effect: TScheduleEffect;
  readonly days: ReadonlySet<EDayOfWeek>;
  readonly from: IResolvedBoundary;
  readonly to: IResolvedBoundary;
}

export interface IOnceRule extends ITimeInterval {
  readonly effect: TScheduleEffect;
}

/** A schedule with every zone filled in and every single stretch already a pair of moments. */
export interface IScheduleRules {
  readonly timeZone: string;
  /** Every zone a boundary is read in, the schedule's first; a week is plain when none of them shifts its clock. */
  readonly timeZones: readonly string[];
  /** No `open` entry: the axis is open save for what the `closed` ones take out (sessions §3). */
  readonly openByDefault: boolean;
  readonly weekly: readonly IWeeklyRule[];
  readonly once: readonly IOnceRule[];
}

export function rulesOf(schedule: ISchedule, axisZone: string): IScheduleRules {
  const timeZone = schedule.timeZone ?? axisZone;
  const weekly: IWeeklyRule[] = [];
  const once: IOnceRule[] = [];
  for (const entry of schedule.entries) {
    const from = resolveBoundary(entry.from, timeZone);
    const to = resolveBoundary(entry.to, timeZone);
    if (entry.kind === 'weekly') {
      weekly.push({ effect: entry.effect, days: new Set(entry.days), from, to });
    } else {
      const interval = { from: momentOf(from), to: momentOf(to) };
      assert(interval.to > interval.from, `a single stretch ends before it starts: ${from.at}`);
      once.push({ effect: entry.effect, ...interval });
    }
  }
  return {
    timeZone,
    timeZones: uniq([timeZone, ...weekly.flatMap(rule => [rule.from.timeZone, rule.to.timeZone])]),
    openByDefault: schedule.entries.every(entry => entry.effect === 'closed'),
    weekly,
    once: once.sort((first, second) => (first.from < second.from ? -1 : 1)),
  };
}

/** The stretches the single entries with the effect cover, merged. */
export function onceIntervalsOf(
  rules: IScheduleRules,
  effect: TScheduleEffect
): readonly ITimeInterval[] {
  return unionOf(rules.once.filter(rule => rule.effect === effect));
}
