import { isNil } from 'lodash-es';

import { ADJACENCY_BOOST, SCORE_VERY_LOW } from './constants';
import type { ICandidate, IToken } from './types';
import { ESeparatorKind, ETokenKind } from './types';

/** How the separators around a number shift its slot scores: a colon says time, a slash says date. */
export function applySeparatorContext(candidates: ICandidate[], fsmTokens: IToken[]): void {
  let colonCount = 0;
  let seenColon = false;

  for (let tokenIndex = 0; tokenIndex < fsmTokens.length; tokenIndex++) {
    const token = fsmTokens[tokenIndex];
    if (token.kind !== ETokenKind.Separator) {
      continue;
    }

    if (token.raw === ESeparatorKind.Colon) {
      colonCount++;
      seenColon = true;

      const prevCandidate = findCandidateAtFsmIndex(candidates, fsmTokens, tokenIndex - 1);
      const nextCandidate = findCandidateAtFsmIndex(candidates, fsmTokens, tokenIndex + 1);

      if (colonCount === 1) {
        if (!isNil(prevCandidate)) {
          prevCandidate.scores.hour += ADJACENCY_BOOST;
        }
        if (!isNil(nextCandidate)) {
          nextCandidate.scores.minute += ADJACENCY_BOOST;
        }
      }

      if (colonCount === 2 && !isNil(nextCandidate)) {
        nextCandidate.scores.second += ADJACENCY_BOOST;
      }
    } else if (token.raw === ESeparatorKind.Dot && seenColon) {
      const nextCandidate = findCandidateAtFsmIndex(candidates, fsmTokens, tokenIndex + 1);
      if (!isNil(nextCandidate)) {
        nextCandidate.scores.ms += ADJACENCY_BOOST;
      }
    } else if (
      token.raw === ESeparatorKind.Dash ||
      token.raw === ESeparatorKind.Slash ||
      (token.raw === ESeparatorKind.Dot && !seenColon)
    ) {
      const prevCandidate = findCandidateAtFsmIndex(candidates, fsmTokens, tokenIndex - 1);
      const nextCandidate = findCandidateAtFsmIndex(candidates, fsmTokens, tokenIndex + 1);
      if (!isNil(prevCandidate)) {
        prevCandidate.scores.day += SCORE_VERY_LOW;
        prevCandidate.scores.month += SCORE_VERY_LOW;
      }
      if (!isNil(nextCandidate)) {
        nextCandidate.scores.day += SCORE_VERY_LOW;
        nextCandidate.scores.month += SCORE_VERY_LOW;
      }
    }
  }
}

function findCandidateAtFsmIndex(
  candidates: ICandidate[],
  fsmTokens: IToken[],
  fsmIndex: number
): ICandidate | undefined {
  if (fsmIndex < 0 || fsmIndex >= fsmTokens.length) {
    return undefined;
  }
  const token = fsmTokens[fsmIndex];
  if (token.kind !== ETokenKind.Number && token.kind !== ETokenKind.Ordinal) {
    return undefined;
  }
  // Count how many non-separator tokens precede this position in the FSM stream
  // to correlate with candidate index in the filtered token stream
  let nonSepIndex = 0;
  for (let index = 0; index < fsmIndex; index++) {
    if (fsmTokens[index].kind !== ETokenKind.Separator) {
      nonSepIndex++;
    }
  }
  return candidates.find(candidate => candidate.index === nonSepIndex);
}
