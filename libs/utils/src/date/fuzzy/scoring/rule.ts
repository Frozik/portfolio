import { compact, isEqual, isNil, sortBy } from 'lodash-es';

import type { ESlot } from '../slot';
import { ALL_SLOTS } from '../slot';
import type { BoardCondition, ICandidate, IScoreboard, NumberTest } from './scoreboard';
import type { IReadingOrder } from './seating';
import { keepsDateAndTimeWhole, readersOf, seatingBy, weightOf } from './seating';
import { closed } from './weights';

export interface IScoringRule {
  readonly name: string;
  readonly apply: (board: IScoreboard) => IScoreboard;
}

interface IScope {
  /** The rule applies to boards that meet the condition; to every board when omitted. */
  readonly when?: BoardCondition;
  /** The rule touches the numbers that pass the test; every number when omitted. */
  readonly whose?: NumberTest;
}

type Amendment = Partial<Pick<ICandidate, 'weights' | 'seat'>>;

function always(): boolean {
  return true;
}

function amended(candidate: ICandidate, ruleName: string, amendment: Amendment): ICandidate {
  const next = { ...candidate, ...amendment };

  return isEqual(next, candidate)
    ? candidate
    : { ...next, changedBy: [...candidate.changedBy, ruleName] };
}

function amend(
  board: IScoreboard,
  ruleName: string,
  { when = always, whose = always }: IScope,
  amendmentOf: (candidate: ICandidate) => Amendment
): IScoreboard {
  if (!when(board)) {
    return board;
  }
  return {
    ...board,
    candidates: board.candidates.map(candidate =>
      whose(candidate, board) ? amended(candidate, ruleName, amendmentOf(candidate)) : candidate
    ),
  };
}

/** A number without a seat is left no reading at all. */
function seatedOn(slot: ESlot | undefined, { weights }: ICandidate): Amendment {
  return {
    seat: slot,
    weights: closed(
      weights,
      ALL_SLOTS.filter(other => other !== slot)
    ),
  };
}

export function close(
  name: string,
  rule: IScope & { readonly slots: readonly ESlot[] | ((board: IScoreboard) => readonly ESlot[]) }
): IScoringRule {
  return {
    name,
    apply: board => {
      const slots = typeof rule.slots === 'function' ? rule.slots(board) : rule.slots;

      return amend(board, name, rule, ({ weights }) => ({ weights: closed(weights, slots) }));
    },
  };
}

export function settle(name: string, rule: IScope & { readonly slot: ESlot }): IScoringRule {
  return {
    name,
    apply: board => amend(board, name, rule, candidate => seatedOn(rule.slot, candidate)),
  };
}

/**
 * Of the orders that seat every number still without a seat, the best is taken. What makes one
 * better, the weightiest reason first: it keeps the date and the time whole; it has the date
 * before the time; it leaves less unsaid; it names a date; the numbers weigh more on its seats;
 * its date order is the more usual.
 */
export function readInOrder(name: string, orders: readonly IReadingOrder[]): IScoringRule {
  return {
    name,
    apply: board => {
      const readings = compact(
        orders.map(order => {
          const seating = seatingBy(order, board);
          return isNil(seating) ? undefined : { order, seating };
        })
      );
      const [reading] = sortBy(readings, [
        ({ seating }) => !keepsDateAndTimeWhole(seating, board),
        ({ order }) => order.isTimeFirst,
        ({ order }) => order.lack,
        ({ order }) => !order.hasDate,
        ({ seating }) => -weightOf(seating),
        ({ order }) => order.usualness,
      ]);

      return amend(
        board,
        `${name}: ${reading?.order.name ?? 'no order fits'}`,
        { whose: reader => readersOf(board).includes(reader) },
        reader => seatedOn(reading?.seating.get(reader), reader)
      );
    },
  };
}
