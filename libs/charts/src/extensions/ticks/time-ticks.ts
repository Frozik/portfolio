import { assertNever } from '@frozik/utils/assert/assertNever';
import { Temporal } from 'temporal-polyfill';

import type { IAxisTick, ITickGenerator, ITickRange } from '../../core/frame/ticks';
import { thinTicks } from './thin-ticks';
import type { ITimeStep } from './time-steps';
import { stepFor } from './time-steps';

const LABEL_WIDTH_PX = 70;
const MIN_LABEL_GAP_PX = 10;
const NANOS_PER_MILLISECOND = 1_000_000;
const MS_PER_DAY = 86_400_000;

export interface ITimeTicksOptions {
  readonly timeZone?: string;
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
 * round moments of the calendar and the clock in the chosen time zone.
 */
export function timeTicks(options: ITimeTicksOptions = {}): ITickGenerator<bigint> {
  const { timeZone = 'UTC', locale = 'en-US' } = options;
  const minGapPx = LABEL_WIDTH_PX + MIN_LABEL_GAP_PX;

  const momentOf = (position: bigint): Temporal.ZonedDateTime =>
    Temporal.Instant.fromEpochNanoseconds(position).toZonedDateTimeISO(timeZone);

  const monthName = (moment: Temporal.ZonedDateTime): string =>
    moment.toPlainDate().toLocaleString(locale, { month: 'short' });

  const chosenStep = (range: ITickRange<bigint>, lengthPx: number): ITimeStep =>
    stepFor(Number(range.end - range.start), Math.floor(lengthPx / minGapPx));

  const label = (moment: Temporal.ZonedDateTime, step: ITimeStep): string => {
    switch (step.unit) {
      case 'year':
        return String(moment.year);
      case 'month':
        return monthName(moment);
      case 'day':
        return String(moment.day);
      case 'hour':
      case 'minute':
        return clock(moment);
      case 'second':
        return `${clock(moment)}:${pad(moment.second)}`;
      case 'millisecond':
        return `${pad(moment.second)}.${pad(moment.millisecond, 3)}`;
      default:
        return assertNever(step.unit);
    }
  };

  /**
   * Ticks at whole multiples of a clock step, counted on the local clock:
   * every clock unit divides a day, so only the zone's offset has to be taken out.
   */
  const clockTicks = (range: ITickRange<bigint>, step: ITimeStep): bigint[] => {
    const positions: bigint[] = [];
    const offset = BigInt(momentOf(range.start).offsetNanoseconds);
    const first = ((range.start + offset) / step.duration) * step.duration - offset;
    for (let position = first; position <= range.end; position += step.duration) {
      if (position >= range.start) {
        positions.push(position);
      }
    }
    return positions;
  };

  /** Ticks on calendar boundaries, whose length varies: days across a clock change, months, years. */
  const calendarTicks = (range: ITickRange<bigint>, step: ITimeStep): bigint[] => {
    const positions: bigint[] = [];
    const end = momentOf(range.end);
    let current = momentOf(range.start).startOfDay();
    if (step.unit !== 'day') {
      current = current.with({ day: 1, ...(step.unit === 'year' ? { month: 1 } : {}) });
    }
    while (Temporal.ZonedDateTime.compare(current, end) <= 0) {
      const ordinal =
        step.unit === 'day'
          ? Math.round(
              (current.epochMilliseconds + current.offsetNanoseconds / NANOS_PER_MILLISECOND) /
                MS_PER_DAY
            )
          : step.unit === 'month'
            ? current.month - 1
            : current.year;
      if (ordinal % step.count === 0 && current.epochNanoseconds >= range.start) {
        positions.push(current.epochNanoseconds);
      }
      current = current.add(
        step.unit === 'day' ? { days: 1 } : step.unit === 'month' ? { months: 1 } : { years: 1 }
      );
    }
    return positions;
  };

  return {
    ticks(range, lengthPx): readonly IAxisTick<bigint>[] {
      const span = Number(range.end - range.start);
      if (span <= 0 || lengthPx <= 0) {
        return [];
      }
      const step = chosenStep(range, lengthPx);
      const isCalendar = step.unit === 'day' || step.unit === 'month' || step.unit === 'year';
      const positions = isCalendar ? calendarTicks(range, step) : clockTicks(range, step);
      return thinTicks(
        positions.map(position => ({ position, label: label(momentOf(position), step) })),
        position => (Number(position - range.start) / span) * lengthPx,
        minGapPx
      );
    },
    format(position, range, lengthPx): string {
      const moment = momentOf(position);
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
          return `${seconds}.${pad(Math.floor(Number(position % 1_000_000_000n) / 1000), 6)}`;
        default:
          return assertNever(unit);
      }
    },
  };
}
