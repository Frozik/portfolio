import { isEmpty, isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

import {
  HOURS_PER_DAY,
  MINUTES_PER_HOUR,
  MS_PER_SECOND,
  SECONDS_PER_MINUTE,
} from '../../constants';
import { EMeridiem } from '../lexer/token';
import { HOURS_ON_THE_DIAL, isWithin } from '../limits';
import type { SlotValues } from '../slot';
import { ESlot, TIME_SLOTS } from '../slot';

const MIDNIGHT = new Temporal.PlainTime();

function isBelow(value: number, limit: number): boolean {
  return isWithin(value, 0, limit - 1);
}

export interface IHalfOfDay {
  /** Every "am" and "pm" written; more than one is a contradiction. */
  readonly told: readonly EMeridiem[];
  /** The half a part of the day implies: "evening" makes the 8 beside it 20:00. */
  readonly implied?: EMeridiem;
}

export function hourOnTheDial(hour: number, meridiem: EMeridiem): number {
  return (hour % HOURS_ON_THE_DIAL) + (meridiem === EMeridiem.Pm ? HOURS_ON_THE_DIAL : 0);
}

/** What is told must fit the dial; what is implied applies only where it can. */
function hourOfDay(hour: number, { told: [told], implied }: IHalfOfDay): number | undefined {
  const isOnTheDial = isWithin(hour, 1, HOURS_ON_THE_DIAL);
  if (!isNil(told)) {
    return isOnTheDial ? hourOnTheDial(hour, told) : undefined;
  }
  return isOnTheDial && !isNil(implied) ? hourOnTheDial(hour, implied) : hour;
}

function plainTimeOf(
  hour: number | undefined,
  minute = 0,
  second = 0,
  millisecond = 0
): Temporal.PlainTime | undefined {
  const isOnTheClock =
    !isNil(hour) &&
    isBelow(hour, HOURS_PER_DAY) &&
    isBelow(minute, MINUTES_PER_HOUR) &&
    isBelow(second, SECONDS_PER_MINUTE) &&
    isBelow(millisecond, MS_PER_SECOND);

  return isOnTheClock ? new Temporal.PlainTime(hour, minute, second, millisecond) : undefined;
}

/** Seconds without minutes, minutes without an hour. */
function hasGap(values: SlotValues): boolean {
  const lastKnown = TIME_SLOTS.findLastIndex(slot => !isNil(values[slot]));

  return TIME_SLOTS.slice(0, lastKnown).some(slot => isNil(values[slot]));
}

/**
 * Midnight when no time is told. `undefined` when what is told is not a time:
 * a part with the larger one missing, 25:00, "pm" twice or with no hour to apply to.
 */
export function timeOfDay(values: SlotValues, half: IHalfOfDay): Temporal.PlainTime | undefined {
  if (half.told.length > 1) {
    return undefined;
  }
  if (TIME_SLOTS.every(slot => isNil(values[slot]))) {
    return isEmpty(half.told) ? MIDNIGHT : undefined;
  }
  if (hasGap(values)) {
    return undefined;
  }
  const hour = values[ESlot.Hour];

  return plainTimeOf(
    isNil(hour) ? undefined : hourOfDay(hour, half),
    values[ESlot.Minute],
    values[ESlot.Second],
    values[ESlot.Millisecond]
  );
}
