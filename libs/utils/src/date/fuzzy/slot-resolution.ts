import { isNil } from 'lodash-es';

import { CERTAIN_OTHER_MAX, CERTAIN_THRESHOLD, SCORE_ZERO } from './constants';
import type { ESlot, ICandidate } from './types';
import { ALL_SLOTS } from './types';

/** Assigning every scored candidate to one slot: the certain ones first, then by propagation, then greedily. */
export function resolveSlots(candidates: ICandidate[]): Map<ICandidate, ESlot> | undefined {
  const result = new Map<ICandidate, ESlot>();
  const assignedSlots = new Set<ESlot>();
  const remaining = [...candidates];

  passCertainAssignments(remaining, result, assignedSlots);
  passConstraintPropagation(remaining, result, assignedSlots);
  passGreedy(remaining, result, assignedSlots);

  if (remaining.length > 0) {
    return undefined;
  }

  return result;
}

function passCertainAssignments(
  remaining: ICandidate[],
  result: Map<ICandidate, ESlot>,
  assignedSlots: Set<ESlot>
): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (let index = remaining.length - 1; index >= 0; index--) {
      const candidate = remaining[index];
      let certainSlot: ESlot | undefined;
      let allOthersLow = true;

      for (const slot of ALL_SLOTS) {
        if (assignedSlots.has(slot)) {
          continue;
        }
        if (candidate.scores[slot] >= CERTAIN_THRESHOLD) {
          certainSlot = slot;
        } else if (candidate.scores[slot] > CERTAIN_OTHER_MAX) {
          allOthersLow = false;
        }
      }

      if (!isNil(certainSlot) && allOthersLow) {
        result.set(candidate, certainSlot);
        assignedSlots.add(certainSlot);
        remaining.splice(index, 1);
        zeroSlotInRemaining(remaining, certainSlot);
        changed = true;
      }
    }
  }
}

function passConstraintPropagation(
  remaining: ICandidate[],
  result: Map<ICandidate, ESlot>,
  assignedSlots: Set<ESlot>
): void {
  let changed = true;
  while (changed) {
    changed = false;
    for (let index = remaining.length - 1; index >= 0; index--) {
      const candidate = remaining[index];
      let singleSlot: ESlot | undefined;
      let count = 0;

      for (const slot of ALL_SLOTS) {
        if (assignedSlots.has(slot)) {
          continue;
        }
        if (candidate.scores[slot] > SCORE_ZERO) {
          singleSlot = slot;
          count++;
        }
      }

      if (count === 1 && !isNil(singleSlot)) {
        result.set(candidate, singleSlot);
        assignedSlots.add(singleSlot);
        remaining.splice(index, 1);
        zeroSlotInRemaining(remaining, singleSlot);
        changed = true;
      }
    }
  }
}

function passGreedy(
  remaining: ICandidate[],
  result: Map<ICandidate, ESlot>,
  assignedSlots: Set<ESlot>
): void {
  while (remaining.length > 0) {
    let bestScore = -1;
    let bestIndex = -1;
    let bestSlot: ESlot = 'day';

    for (let index = 0; index < remaining.length; index++) {
      const candidate = remaining[index];
      for (const slot of ALL_SLOTS) {
        if (!assignedSlots.has(slot) && candidate.scores[slot] > bestScore) {
          bestScore = candidate.scores[slot];
          bestIndex = index;
          bestSlot = slot;
        }
      }
    }

    if (bestScore <= SCORE_ZERO || bestIndex < 0) {
      break;
    }

    const assigned = remaining[bestIndex];
    result.set(assigned, bestSlot);
    assignedSlots.add(bestSlot);
    remaining.splice(bestIndex, 1);
    zeroSlotInRemaining(remaining, bestSlot);
  }
}

function zeroSlotInRemaining(remaining: ICandidate[], slot: ESlot): void {
  for (const candidate of remaining) {
    candidate.scores[slot] = SCORE_ZERO;
  }
}
