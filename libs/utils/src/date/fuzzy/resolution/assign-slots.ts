import { isNil } from 'lodash-es';

import type { ICandidate } from '../scoring/scoreboard';
import { closed, isPossible } from '../scoring/weights';
import type { SlotValues } from '../slot';
import { ALL_SLOTS, ESlot } from '../slot';
import { toFullYear } from '../year';

interface IClaim {
  readonly candidate: ICandidate;
  readonly slot: ESlot;
  readonly weight: number;
}

function strongestClaim(candidates: readonly ICandidate[]): IClaim | undefined {
  return candidates
    .flatMap(candidate =>
      ALL_SLOTS.filter(slot => isPossible(candidate.weights, slot)).map(slot => ({
        candidate,
        slot,
        weight: candidate.weights[slot],
      }))
    )
    .reduce<IClaim | undefined>(
      (strongest, claim) =>
        isNil(strongest) || claim.weight > strongest.weight ? claim : strongest,
      undefined
    );
}

function valueOf({ candidate, slot }: IClaim): number {
  return slot === ESlot.Year ? toFullYear(candidate.token.value) : candidate.token.value;
}

/**
 * The most confident reading is settled first, then the most confident among what is left.
 * A number left with no slot makes the whole input unreadable.
 */
export function assignSlots(candidates: readonly ICandidate[]): SlotValues | undefined {
  if (candidates.length === 0) {
    return {};
  }
  const claim = strongestClaim(candidates);
  if (isNil(claim)) {
    return undefined;
  }
  const others = candidates
    .filter(candidate => candidate !== claim.candidate)
    .map(candidate => ({ ...candidate, weights: closed(candidate.weights, [claim.slot]) }));
  const rest = assignSlots(others);

  return isNil(rest) ? undefined : { ...rest, [claim.slot]: valueOf(claim) };
}
