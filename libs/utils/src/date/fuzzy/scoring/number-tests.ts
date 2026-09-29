import { isNil } from 'lodash-es';

import { HOURS_PER_DAY } from '../../constants';
import { ETokenKind } from '../lexer/token';
import { HOURS_ON_THE_DIAL, isWithin } from '../limits';
import { ALL_SLOTS, ESlot } from '../slot';
import { isJoinedIntoDate } from './joints';
import { plausibilityOf } from './plausibility';
import type { ICandidate, IScoreboard, NumberTest } from './scoreboard';
import { numberAt } from './scoreboard';
import { slotsStatedBy } from './stated-slots';
import { isPossible } from './weights';

const FIRST_FULL_YEAR = 1000;

const WORDS_A_YEAR_FOLLOWS: ReadonlySet<ETokenKind> = new Set([
  ETokenKind.MonthName,
  ETokenKind.Ordinal,
  ETokenKind.Quarter,
]);

export function unless(...tests: readonly NumberTest[]): NumberTest {
  return (candidate, board) => !tests.some(test => test(candidate, board));
}

export function both(...tests: readonly NumberTest[]): NumberTest {
  return (candidate, board) => tests.every(test => test(candidate, board));
}

export const isWrittenAfterAnOffset: NumberTest = ({ position }, { tokens }) =>
  tokens.slice(0, position).some(token => token.kind === ETokenKind.Offset);

export const isFullYear: NumberTest = ({ token }) => token.value >= FIRST_FULL_YEAR;

/**
 * By its size alone, whatever the rules have closed since: 2025 and 99 can be nothing but
 * a year, while 45 may as well be a minute and 27 a day.
 */
export const canOnlyBeYear: NumberTest = ({ token }) =>
  ALL_SLOTS.every(slot => isPossible(plausibilityOf(token.value), slot) === (slot === ESlot.Year));

const standsBeforeMeridiem: NumberTest = ({ position }, { tokens }) =>
  tokens[position + 1]?.kind === ETokenKind.Meridiem;

const fitsTheDial: NumberTest = ({ token }) => isWithin(token.value, 1, HOURS_ON_THE_DIAL);

/** "9 30 pm": too large for the dial, the number before am or pm is the minute of the hour before it. */
export const standsForTheMinuteBeforeMeridiem: NumberTest = (candidate, board) => {
  const hour = numberAt(board, candidate.position - 1);

  return (
    standsBeforeMeridiem(candidate, board) &&
    !fitsTheDial(candidate, board) &&
    !isNil(hour) &&
    fitsTheDial(hour, board)
  );
};

export const standsForTheHourBeforeMeridiem: NumberTest = (candidate, board) => {
  const next = numberAt(board, candidate.position + 1);

  return (
    fitsTheDial(candidate, board) &&
    (standsBeforeMeridiem(candidate, board) ||
      (!isNil(next) && standsForTheMinuteBeforeMeridiem(next, board)))
  );
};

export const isJoinedByDateSeparator: NumberTest = ({ position }, { tokens }) =>
  isJoinedIntoDate(tokens, position);

/** Whether the token written right before states the slot or may still turn out to be it. */
export function comesRightAfter(slot: ESlot): NumberTest {
  return ({ position }, board) => {
    const previous = board.tokens[position - 1];
    const previousNumber = numberAt(board, position - 1);

    return (
      !isNil(previous) &&
      (slotsStatedBy(previous).includes(slot) ||
        (!isNil(previousNumber) && isPossible(previousNumber.weights, slot)))
    );
  };
}

function standsBesideMonthName({ position }: ICandidate, { tokens }: IScoreboard): boolean {
  return [tokens[position - 1], tokens[position + 1]].some(
    neighbour => neighbour?.kind === ETokenKind.MonthName
  );
}

function isFollowedByYear({ position }: ICandidate, board: IScoreboard): boolean {
  const nextNumber = numberAt(board, position + 1);

  return (
    board.tokens[position + 1]?.kind === ETokenKind.Year ||
    (!isNil(nextNumber) && isFullYear(nextNumber, board))
  );
}

/** "8 30 jan 15, 2025": of two numbers around the month name, the one a year follows is the day. */
export const standsForTheDay: NumberTest = (candidate, board) => {
  const besideTheMonth = board.candidates.filter(
    other => standsBesideMonthName(other, board) && isPossible(other.weights, ESlot.Day)
  );

  return (
    candidate ===
    (besideTheMonth.find(other => isFollowedByYear(other, board)) ?? besideTheMonth[0])
  );
};

function comesRightAfterTheDate({ position }: ICandidate, board: IScoreboard): boolean {
  const previous = board.tokens[position - 1];
  const previousNumber = numberAt(board, position - 1);

  return (
    !isNil(previous) &&
    (WORDS_A_YEAR_FOLLOWS.has(previous.kind) ||
      (!isNil(previousNumber) && standsForTheDay(previousNumber, board)))
  );
}

/** "15 jan 27" is a year, "15 jan 17" an hour: only a number no hour can hold is read as the year. */
export const standsForTheYear: NumberTest = (candidate, board) =>
  isPossible(candidate.weights, ESlot.Year) &&
  candidate.token.value >= HOURS_PER_DAY &&
  comesRightAfterTheDate(candidate, board);
