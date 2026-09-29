import type { Token } from '../lexer/token';
import { ETokenKind } from '../lexer/token';
import { plausibilityOf } from './plausibility';
import { SCORING_RULES } from './rules';
import type { ICandidate, IScoreboard } from './scoreboard';

function seat(tokens: readonly Token[]): IScoreboard {
  return {
    tokens,
    candidates: tokens.flatMap((token, position) =>
      token.kind === ETokenKind.Number
        ? [{ token, position, weights: plausibilityOf(token.value), changedBy: [] }]
        : []
    ),
  };
}

export function scoreCandidates(tokens: readonly Token[]): readonly ICandidate[] {
  return SCORING_RULES.reduce((board, rule) => rule.apply(board), seat(tokens)).candidates;
}
