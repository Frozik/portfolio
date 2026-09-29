import type { ETokenKind } from '../lexer/token';
import { ESlot } from '../slot';
import { isJoinedByDateSeparator } from './number-tests';
import type { BoardCondition } from './scoreboard';
import { slotsStatedByWords } from './stated-slots';

export function has(kind: ETokenKind): BoardCondition {
  return ({ tokens }) => tokens.some(token => token.kind === kind);
}

export function allOf(...conditions: readonly BoardCondition[]): BoardCondition {
  return board => conditions.every(condition => condition(board));
}

export function not(condition: BoardCondition): BoardCondition {
  return board => !condition(board);
}

export const wordsNameTheDayOrMonth: BoardCondition = board =>
  slotsStatedByWords(board).some(slot => slot === ESlot.Month || slot === ESlot.Day);

export const someNumbersAreJoined: BoardCondition = board =>
  board.candidates.some(candidate => isJoinedByDateSeparator(candidate, board));
