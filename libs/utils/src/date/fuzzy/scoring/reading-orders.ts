import { isEmpty, range } from 'lodash-es';

import { ESlot, TIME_SLOTS } from '../slot';
import { canOnlyBeYear } from './number-tests';
import type { IReadingOrder, ISeat } from './seating';

const DAY: ISeat = { slot: ESlot.Day };
const MONTH: ISeat = { slot: ESlot.Month };
const YEAR: ISeat = { slot: ESlot.Year };
/** A year is expected last. Anywhere else it must be unmistakable: "99 12 31", but "25 12" is no December 2025. */
const UNMISTAKABLE_YEAR: ISeat = { slot: ESlot.Year, only: canOnlyBeYear };

/** The ways a date is written in numbers, the most usual first. */
const DATE_ORDERS: readonly (readonly ISeat[])[] = [
  [DAY, MONTH, YEAR],
  [MONTH, DAY, YEAR],
  [UNMISTAKABLE_YEAR, MONTH, DAY],
  [DAY, MONTH],
  [MONTH, DAY],
  [MONTH, UNMISTAKABLE_YEAR],
  [UNMISTAKABLE_YEAR, MONTH],
  [DAY],
  [],
];

/** A time is written from the hour down and may stop after any part: "10", "10 30", "10 30 45". */
const TIME_ORDERS: readonly (readonly ISeat[])[] = range(TIME_SLOTS.length + 1).map(length =>
  TIME_SLOTS.slice(0, length).map(slot => ({ slot }))
);

const FULL_DATE_LENGTH = 3;

/** How much a reading leaves unsaid: a date short of a part, an hour without its minutes. */
function lackOf(date: readonly ISeat[], time: readonly ISeat[]): number {
  const isPartialDate = !isEmpty(date) && date.length < FULL_DATE_LENGTH;
  const isLoneHour = time.length === 1;

  return Number(isPartialDate) + Number(isLoneHour);
}

function named(seats: readonly ISeat[]): string {
  return seats.map(({ slot }) => slot).join(' ');
}

function readingsOf(date: readonly ISeat[], usualness: number): readonly IReadingOrder[] {
  return TIME_ORDERS.flatMap(time => {
    const reading = { lack: lackOf(date, time), hasDate: !isEmpty(date), usualness };
    const dateFirst = { ...reading, seats: [...date, ...time], isTimeFirst: false };
    const timeFirst = { ...reading, seats: [...time, ...date], isTimeFirst: true };
    const hasBothParts = !isEmpty(date) && !isEmpty(time);

    return (hasBothParts ? [dateFirst, timeFirst] : [dateFirst]).map(order => ({
      ...order,
      name: named(order.seats),
    }));
  });
}

/** Every date order with every time, the date first and then the time first. */
export const READING_ORDERS: readonly IReadingOrder[] = DATE_ORDERS.flatMap(readingsOf).filter(
  ({ seats }) => !isEmpty(seats)
);
