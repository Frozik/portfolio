import type { ETokenKind, Token, TokenOf } from '../lexer/token';
import type { ESlot } from '../slot';
import type { SlotWeights } from './weights';

export interface ICandidate {
  readonly token: TokenOf<ETokenKind.Number>;
  readonly position: number;
  readonly weights: SlotWeights;
  /** The slot the reading order has given the number, once it has given one. */
  readonly seat?: ESlot;
  /** The names of the rules that changed the number, in the order they did. */
  readonly changedBy: readonly string[];
}

export interface IScoreboard {
  readonly tokens: readonly Token[];
  readonly candidates: readonly ICandidate[];
}

export type BoardCondition = (board: IScoreboard) => boolean;

export type NumberTest = (candidate: ICandidate, board: IScoreboard) => boolean;

export function numberAt({ candidates }: IScoreboard, position: number): ICandidate | undefined {
  return candidates.find(candidate => candidate.position === position);
}
