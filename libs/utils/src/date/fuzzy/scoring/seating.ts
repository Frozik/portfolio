import { compact, isNil, sumBy, uniq } from 'lodash-es';

import type { ESlot } from '../slot';
import { DATE_SLOTS, TIME_SLOTS } from '../slot';
import type { ICandidate, IScoreboard, NumberTest } from './scoreboard';
import { numberAt } from './scoreboard';
import { slotsStatedBy, slotsStatedByWords } from './stated-slots';
import { isPossible } from './weights';

export interface ISeat {
  readonly slot: ESlot;
  readonly only?: NumberTest;
}

export interface IReadingOrder {
  readonly name: string;
  readonly seats: readonly ISeat[];
  readonly isTimeFirst: boolean;
  /** How much the reading leaves unsaid: a date short of a part, an hour without its minutes. */
  readonly lack: number;
  readonly hasDate: boolean;
  /** The place of its date order among the ways a date is written, the most usual first. */
  readonly usualness: number;
}

export type Seating = ReadonlyMap<ICandidate, ESlot>;

enum EPart {
  Date = 'Date',
  Time = 'Time',
}

function always(): boolean {
  return true;
}

export function readersOf({ candidates }: IScoreboard): readonly ICandidate[] {
  return candidates.filter(({ seat }) => isNil(seat));
}

/** The seats of an order that nothing has taken yet: neither a word nor a number settled before. */
function freeSeats({ seats }: IReadingOrder, board: IScoreboard): readonly ISeat[] {
  const taken = [
    ...slotsStatedByWords(board),
    ...compact(board.candidates.map(({ seat }) => seat)),
  ];

  return seats.filter(({ slot }) => !taken.includes(slot));
}

function fits(reader: ICandidate, { slot, only = always }: ISeat, board: IScoreboard): boolean {
  return only(reader, board) && isPossible(reader.weights, slot);
}

/** The seats an order gives the readers, one each in the order written — if each of them fits. */
export function seatingBy(order: IReadingOrder, board: IScoreboard): Seating | undefined {
  const readers = readersOf(board);
  const seats = freeSeats(order, board);
  const isFull =
    seats.length === readers.length &&
    seats.every((seat, place) => fits(readers[place], seat, board));

  return isFull ? new Map(readers.map((reader, place) => [reader, seats[place].slot])) : undefined;
}

function partOf(slots: readonly ESlot[]): EPart | undefined {
  const parts = uniq(
    compact([
      slots.some(slot => DATE_SLOTS.includes(slot)) ? EPart.Date : undefined,
      slots.some(slot => TIME_SLOTS.includes(slot)) ? EPart.Time : undefined,
    ])
  );

  return parts.length === 1 ? parts[0] : undefined;
}

export function weightOf(seating: Seating): number {
  return sumBy([...seating], ([reader, slot]) => reader.weights[slot]);
}

/**
 * People write the date in one piece and the time in one piece. "5 03 8:05 45" read as
 * day, month, time, year would tear the date in two; read as day, month, time, seconds it does not.
 */
export function keepsDateAndTimeWhole(seating: Seating, board: IScoreboard): boolean {
  const written = compact(
    board.tokens.map((token, position) => {
      const number = numberAt(board, position);
      const seat = isNil(number) ? undefined : (number.seat ?? seating.get(number));

      return partOf(isNil(seat) ? slotsStatedBy(token) : [seat]);
    })
  );
  const pieces = written.filter((part, place) => part !== written[place - 1]);

  return uniq(pieces).length === pieces.length;
}
