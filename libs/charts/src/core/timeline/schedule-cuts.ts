import { getStartOfWeek } from '@frozik/utils/date/boundaries';
import { NANOS_PER_DAY, NANOS_PER_WEEK } from '@frozik/utils/date/constants';
import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

import { assert } from '@frozik/utils/assert/assert';
import type { IAxisMapping, ICutsDefinition } from '../viewport/axis-mapping';
import { suppliedMapping } from '../viewport/axis-mapping';
import type { ICutSupply } from '../viewport/cut-table';
import { isTimeDomain } from '../viewport/time-domain';
import type { ITimeInterval } from './intervals';
import { clippedTo } from './intervals';
import type { ISchedule } from './schedule';
import type { IScheduleRules } from './schedule-rules';
import { rulesOf } from './schedule-rules';
import { cutsOfWeek } from './week-cuts';

/** A week is placed from a day before it to a day after (week-cuts); the clocks must hold still that whole stretch. */
const PLAIN_WEEK_SLACK = BigInt(NANOS_PER_DAY);

/**
 * The cuts a schedule makes, week by week in the schedule's zone. A week in
 * which no zone shifts its clock and no single entry falls is the same as
 * every other such week with the same clock offsets, so it is placed once
 * and then copied — that is what makes a table from the epoch to today
 * a matter of milliseconds (sessions §3).
 */
class ScheduleSupply implements ICutSupply<bigint> {
  readonly stride = NANOS_PER_WEEK;
  private readonly plainWeeks = new Map<string, readonly ITimeInterval[]>();

  constructor(private readonly rules: IScheduleRules) {}

  cutsBetween(from: bigint, to: bigint): readonly ITimeInterval[] {
    const found: ITimeInterval[] = [];
    let weekStart = this.weekStartOf(from);
    while (weekStart.epochNanoseconds < to) {
      const weekEnd = weekStart.add({ weeks: 1 });
      found.push(...clippedTo({ from, to }, this.cutsOf(weekStart, weekEnd)));
      weekStart = weekEnd;
    }
    return found;
  }

  private weekStartOf(moment: bigint): Temporal.ZonedDateTime {
    const { timeZone } = this.rules;
    const date = Temporal.Instant.fromEpochNanoseconds(moment).toZonedDateTimeISO(timeZone);
    return getStartOfWeek(date.toPlainDate()).toZonedDateTime({ timeZone });
  }

  private cutsOf(
    weekStart: Temporal.ZonedDateTime,
    weekEnd: Temporal.ZonedDateTime
  ): readonly ITimeInterval[] {
    const key = this.plainWeekKeyOf(weekStart.epochNanoseconds, weekEnd.epochNanoseconds);
    if (isNil(key)) {
      return cutsOfWeek(this.rules, weekStart, weekEnd);
    }
    const start = weekStart.epochNanoseconds;
    let relative = this.plainWeeks.get(key);
    if (isNil(relative)) {
      relative = cutsOfWeek(this.rules, weekStart, weekEnd).map(cut => ({
        from: cut.from - start,
        to: cut.to - start,
      }));
      this.plainWeeks.set(key, relative);
    }
    return relative.map(cut => ({ from: start + cut.from, to: start + cut.to }));
  }

  /** The clock offsets every zone keeps through the week and its margins; none when one shifts or a single entry falls in. */
  private plainWeekKeyOf(weekStart: bigint, weekEnd: bigint): string | undefined {
    const from = weekStart - PLAIN_WEEK_SLACK;
    const to = weekEnd + PLAIN_WEEK_SLACK;
    if (this.rules.once.some(rule => rule.from < to && rule.to > from)) {
      return undefined;
    }
    const offsets: number[] = [];
    for (const timeZone of this.rules.timeZones) {
      const offset = offsetIn(timeZone, from);
      if (offset !== offsetIn(timeZone, to)) {
        return undefined;
      }
      offsets.push(offset);
    }
    return offsets.join(',');
  }
}

function offsetIn(timeZone: string, moment: bigint): number {
  return Temporal.Instant.fromEpochNanoseconds(moment).toZonedDateTimeISO(timeZone)
    .offsetNanoseconds;
}

/** The closed stretches of a schedule taken out of the axis of time, as far as it is looked at. */
export function schedule(definition: ISchedule): ICutsDefinition<bigint> {
  return {
    mappingOf(domain): IAxisMapping<bigint> {
      assert(isTimeDomain(domain), 'a schedule cuts the axis of time');
      const rules = rulesOf(definition, domain.timeZone);
      const id = `schedule:${JSON.stringify({ timeZone: rules.timeZone, entries: definition.entries })}`;
      return suppliedMapping(domain, id, new ScheduleSupply(rules));
    },
  };
}
