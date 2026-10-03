import { assertNever } from '@frozik/utils/assert/assertNever';
import { Temporal } from 'temporal-polyfill';

import { assert } from '@frozik/utils/assert/assert';
import { NANOS_PER_MICROSECOND, NANOS_PER_SECOND } from '@frozik/utils/date/constants';

import type { IAxisTick, ITickAxis, ITickGenerator, ITickRange } from '../../core/frame/ticks';
import { isTimeDomain } from '../../core/viewport/time-domain';
import type { ITickCandidate } from './laid-out';
import { laidOut } from './laid-out';
import type { ITimeStep } from './time-steps';
import { stepFor } from './time-steps';

const LABEL_WIDTH_PX = 70;
const MIN_LABEL_GAP_PX = 10;
const CLOCK_RANK = 0;
const DAY_RANK = 1;
const MONTH_RANK = 2;
const YEAR_RANK = 3;

export interface ITimeTicksOptions {
  readonly locale?: string;
}

function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0');
}

function clock(moment: Temporal.ZonedDateTime): string {
  return `${pad(moment.hour)}:${pad(moment.minute)}`;
}

/**
 * Ticks of a time axis in nanoseconds from the Unix epoch, from milliseconds
 * up to years: the step is the finest whose labels still fit, ticks stand on
 * round moments of the calendar and the clock in the zone of the axis.
 */
export function timeTicks(options: ITimeTicksOptions = {}): ITickGenerator<bigint> {
  const { locale = 'en-US' } = options;
  const minGapPx = LABEL_WIDTH_PX + MIN_LABEL_GAP_PX;

  const timeZoneOf = ({ domain }: ITickAxis<bigint>): string => {
    assert(isTimeDomain(domain), 'time ticks stand on an axis of time');
    return domain.timeZone;
  };

  const momentOf = (position: bigint, timeZone: string): Temporal.ZonedDateTime =>
    Temporal.Instant.fromEpochNanoseconds(position).toZonedDateTimeISO(timeZone);

  const monthName = (moment: Temporal.ZonedDateTime): string =>
    moment.toPlainDate().toLocaleString(locale, { month: 'short' });

  const chosenStep = (range: ITickRange<bigint>, lengthPx: number): ITimeStep =>
    stepFor(Number(range.end - range.start), Math.floor(lengthPx / minGapPx));

  const startsDay = (moment: Temporal.ZonedDateTime): boolean =>
    moment.epochNanoseconds === moment.startOfDay().epochNanoseconds;
  const dateLabel = (moment: Temporal.ZonedDateTime): string =>
    `${moment.day} ${monthName(moment)}`;
  const secondsLabel = (moment: Temporal.ZonedDateTime): string =>
    `${clock(moment)}:${pad(moment.second)}`;
  const isCalendarStep = (step: ITimeStep): boolean =>
    step.unit === 'day' || step.unit === 'month' || step.unit === 'year';

  /** The largest unit a moment begins: a year, a month, a day, or none of them. */
  const rankOf = (moment: Temporal.ZonedDateTime): number => {
    if (!startsDay(moment)) {
      return CLOCK_RANK;
    }
    if (moment.day !== 1) {
      return DAY_RANK;
    }
    return moment.month === 1 ? YEAR_RANK : MONTH_RANK;
  };

  /**
   * A tick that begins a larger unit is named by it — the year at January,
   * the month at its first day, the date at midnight, the second at a whole
   * one — so a row of labels reads without a doubt what each belongs to. The
   * calendar unit is the candidate's, even when a cut swallowed its moment
   * and the tick stands at the cut's edge; the clock is read where it stands.
   */
  const describe = (
    candidate: bigint,
    shown: bigint,
    step: ITimeStep,
    timeZone: string
  ): ITickCandidate => {
    const moment = momentOf(candidate, timeZone);
    const rank = rankOf(moment);
    if (rank === YEAR_RANK) {
      return { rank, label: isCalendarStep(step) ? String(moment.year) : dateLabel(moment) };
    }
    if (rank === MONTH_RANK) {
      return { rank, label: isCalendarStep(step) ? monthName(moment) : dateLabel(moment) };
    }
    if (rank === DAY_RANK) {
      return { rank, label: step.unit === 'day' ? String(moment.day) : dateLabel(moment) };
    }
    const stands = momentOf(shown, timeZone);
    switch (step.unit) {
      case 'hour':
      case 'minute':
        return { rank, label: clock(stands) };
      case 'second':
        return { rank, label: secondsLabel(stands) };
      case 'millisecond':
        return {
          rank,
          label:
            stands.millisecond === 0
              ? secondsLabel(stands)
              : `${pad(stands.second)}.${pad(stands.millisecond, 3)}`,
        };
      case 'day':
      case 'month':
      case 'year':
        return { rank, label: dateLabel(stands) };
      default:
        return assertNever(step.unit);
    }
  };

  /**
   * Ticks at whole multiples of a clock step, counted on the local clock:
   * every clock unit divides a day, so only the zone's offset has to be taken out.
   */
  const clockTicks = (range: ITickRange<bigint>, step: ITimeStep, timeZone: string): bigint[] => {
    const positions: bigint[] = [];
    const offset = BigInt(momentOf(range.start, timeZone).offsetNanoseconds);
    const first = ((range.start + offset) / step.duration) * step.duration - offset;
    for (let position = first; position <= range.end; position += step.duration) {
      if (position >= range.start) {
        positions.push(position);
      }
    }
    return positions;
  };

  /**
   * Days are counted from the first of each month, so the first is always a
   * tick; the last multiple of a month is left out when the next first comes
   * sooner than a step after it.
   */
  const onDayGrid = (moment: Temporal.ZonedDateTime, count: number): boolean =>
    (moment.day - 1) % count === 0 && moment.day + count <= moment.daysInMonth + 1;

  /** Ticks on calendar boundaries, whose length varies: days across a clock change, months, years. */
  const calendarTicks = (
    range: ITickRange<bigint>,
    step: ITimeStep,
    timeZone: string
  ): bigint[] => {
    const positions: bigint[] = [];
    const end = momentOf(range.end, timeZone);
    let current = momentOf(range.start, timeZone).startOfDay();
    if (step.unit !== 'day') {
      current = current.with({ day: 1, ...(step.unit === 'year' ? { month: 1 } : {}) });
    }
    while (Temporal.ZonedDateTime.compare(current, end) <= 0) {
      const onGrid =
        step.unit === 'day'
          ? onDayGrid(current, step.count)
          : (step.unit === 'month' ? current.month - 1 : current.year) % step.count === 0;
      if (onGrid && current.epochNanoseconds >= range.start) {
        positions.push(current.epochNanoseconds);
      }
      current = current.add(
        step.unit === 'day' ? { days: 1 } : step.unit === 'month' ? { months: 1 } : { years: 1 }
      );
    }
    return positions;
  };

  return {
    ticks(axis): readonly IAxisTick<bigint>[] {
      const { range, lengthPx } = axis;
      const span = Number(range.end - range.start);
      if (span <= 0 || lengthPx <= 0) {
        return [];
      }
      const timeZone = timeZoneOf(axis);
      const step = chosenStep(range, lengthPx);
      const candidates = isCalendarStep(step)
        ? calendarTicks(range, step, timeZone)
        : clockTicks(range, step, timeZone);
      return laidOut(candidates, axis, minGapPx, (candidate, shown) =>
        describe(candidate, shown, step, timeZone)
      );
    },
    format(position, axis): string {
      const { range, lengthPx } = axis;
      const moment = momentOf(position, timeZoneOf(axis));
      const date = `${moment.day} ${monthName(moment)}`;
      const seconds = `${clock(moment)}:${pad(moment.second)}`;
      const { unit } = chosenStep(range, lengthPx);
      switch (unit) {
        case 'year':
        case 'month':
          return `${date} ${moment.year}`;
        case 'day':
          return `${date} ${clock(moment)}`;
        case 'hour':
        case 'minute':
          return `${date} ${seconds}`;
        case 'second':
          return `${seconds}.${pad(moment.millisecond, 3)}`;
        case 'millisecond':
          return `${seconds}.${pad(Math.floor(Number(position % BigInt(NANOS_PER_SECOND)) / NANOS_PER_MICROSECOND), 6)}`;
        default:
          return assertNever(unit);
      }
    },
  };
}
