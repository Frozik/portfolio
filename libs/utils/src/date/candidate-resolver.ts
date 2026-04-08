import { isNil } from 'lodash-es';

import {
  ADJACENCY_BOOST,
  AMPM_BOOST,
  CERTAIN_OTHER_MAX,
  CERTAIN_THRESHOLD,
  HOURS_IN_DAY,
  MIN_4_DIGIT_YEAR,
  MONTHS_IN_YEAR,
  POSITION_BOOST,
  SCORE_CERTAIN,
  SCORE_HALF,
  SCORE_HIGH,
  SCORE_LOW,
  SCORE_MEDIUM,
  SCORE_MEDIUM_HIGH,
  SCORE_MEDIUM_LOW,
  SCORE_VERY_HIGH,
  SCORE_VERY_LOW,
  SCORE_ZERO,
} from './constants';
import type { ESlot, ICandidate, ISlotContext, IToken } from './token-types';
import { ALL_SLOTS, ETokenKind } from './token-types';

export function tagCandidates(tokens: IToken[], _context: ISlotContext): ICandidate[] {
  const candidates: ICandidate[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.kind === ETokenKind.Number || token.kind === ETokenKind.Ordinal) {
      candidates.push({
        token,
        index: i,
        scores: { ...getBaseScores(token.value) },
      });
    }
  }

  return candidates;
}

export function getBaseScores(value: number): Record<ESlot, number> {
  if (value >= MIN_4_DIGIT_YEAR) {
    return {
      year: SCORE_CERTAIN,
      month: SCORE_ZERO,
      day: SCORE_ZERO,
      hour: SCORE_ZERO,
      minute: SCORE_ZERO,
      second: SCORE_ZERO,
      ms: SCORE_ZERO,
    };
  }

  if (value >= 100) {
    return {
      year: SCORE_ZERO,
      month: SCORE_ZERO,
      day: SCORE_ZERO,
      hour: SCORE_ZERO,
      minute: SCORE_ZERO,
      second: SCORE_ZERO,
      ms: SCORE_CERTAIN,
    };
  }

  if (value >= 60) {
    return {
      year: SCORE_VERY_HIGH,
      month: SCORE_ZERO,
      day: SCORE_ZERO,
      hour: SCORE_ZERO,
      minute: SCORE_ZERO,
      second: SCORE_ZERO,
      ms: SCORE_ZERO,
    };
  }

  if (value >= 32) {
    return {
      year: SCORE_VERY_LOW,
      month: SCORE_ZERO,
      day: SCORE_ZERO,
      hour: SCORE_ZERO,
      minute: SCORE_HALF,
      second: SCORE_HALF,
      ms: SCORE_ZERO,
    };
  }

  if (value >= HOURS_IN_DAY) {
    return {
      year: SCORE_LOW,
      month: SCORE_ZERO,
      day: SCORE_HIGH,
      hour: SCORE_ZERO,
      minute: SCORE_MEDIUM_LOW,
      second: SCORE_MEDIUM_LOW,
      ms: SCORE_ZERO,
    };
  }

  if (value >= MONTHS_IN_YEAR + 1) {
    return {
      year: SCORE_VERY_LOW,
      month: SCORE_ZERO,
      day: SCORE_HALF,
      hour: SCORE_MEDIUM_HIGH,
      minute: SCORE_MEDIUM_LOW,
      second: SCORE_MEDIUM_LOW,
      ms: SCORE_ZERO,
    };
  }

  if (value >= 1) {
    return {
      year: SCORE_ZERO,
      month: SCORE_HALF,
      day: SCORE_HALF,
      hour: SCORE_MEDIUM,
      minute: SCORE_MEDIUM_LOW,
      second: SCORE_MEDIUM_LOW,
      ms: SCORE_ZERO,
    };
  }

  // 0
  return {
    year: SCORE_ZERO,
    month: SCORE_ZERO,
    day: SCORE_ZERO,
    hour: SCORE_HALF,
    minute: SCORE_MEDIUM_HIGH,
    second: SCORE_MEDIUM_HIGH,
    ms: SCORE_HALF,
  };
}

export function applyContextRules(
  candidates: ICandidate[],
  tokens: IToken[],
  context: ISlotContext
): void {
  applyKnownSlotElimination(candidates, context);
  applyMonthAdjacency(candidates, tokens);
  applyPositionRules(candidates, context);
  applyAmPmInfluence(candidates, context);
}

function applyKnownSlotElimination(candidates: ICandidate[], context: ISlotContext): void {
  if (context.hasMonthName) {
    for (const c of candidates) {
      c.scores.month = SCORE_ZERO;
    }
  }

  if (context.hasDateKeyword || context.hasBoundaryKeyword) {
    for (const c of candidates) {
      c.scores.day = SCORE_ZERO;
      c.scores.month = SCORE_ZERO;
      c.scores.year = SCORE_ZERO;
    }
  }

  if (context.hasColonTime || context.hasTimeKeyword) {
    for (const c of candidates) {
      c.scores.hour = SCORE_ZERO;
      c.scores.minute = SCORE_ZERO;
      c.scores.second = SCORE_ZERO;
      c.scores.ms = SCORE_ZERO;
    }
  }

  if (context.hasOrdinal) {
    for (const c of candidates) {
      if (c.token.kind === ETokenKind.Number) {
        c.scores.day = SCORE_ZERO;
      }
    }
  }
}

function applyMonthAdjacency(candidates: ICandidate[], tokens: IToken[]): void {
  for (const c of candidates) {
    const tokenIndex = c.index;

    if (tokenIndex > 0 && tokens[tokenIndex - 1].kind === ETokenKind.MonthName) {
      c.scores.day += ADJACENCY_BOOST;
    }

    if (tokenIndex < tokens.length - 1 && tokens[tokenIndex + 1].kind === ETokenKind.MonthName) {
      c.scores.day += ADJACENCY_BOOST;
    }
  }
}

const TIME_SLOT_ORDER: readonly ESlot[] = ['hour', 'minute', 'second', 'ms'];

function applyPositionRules(candidates: ICandidate[], context: ISlotContext): void {
  if (context.hasDateKeyword || context.hasBoundaryKeyword) {
    for (let i = 0; i < candidates.length; i++) {
      if (i < TIME_SLOT_ORDER.length) {
        candidates[i].scores[TIME_SLOT_ORDER[i]] += POSITION_BOOST;
      }
    }
    return;
  }

  if (context.hasMonthName) {
    let timeIdx = 0;
    for (let i = 0; i < candidates.length; i++) {
      if (i === 0 && !context.hasOrdinal) {
        candidates[i].scores.day += POSITION_BOOST;
      } else {
        const tIdx = context.hasOrdinal ? i : timeIdx;
        if (tIdx < TIME_SLOT_ORDER.length) {
          candidates[i].scores[TIME_SLOT_ORDER[tIdx]] += POSITION_BOOST;
        }
        timeIdx++;
      }
    }
    return;
  }

  const hasCertainYearFirst =
    candidates.length > 0 && candidates[0].token.value >= MIN_4_DIGIT_YEAR;

  const dateSlots: readonly ESlot[] = hasCertainYearFirst
    ? ['year', 'month', 'day']
    : ['day', 'month', 'year'];

  const timeStartPosition = dateSlots.length;

  for (let i = 0; i < candidates.length; i++) {
    if (i < dateSlots.length) {
      candidates[i].scores[dateSlots[i]] += POSITION_BOOST;
    } else {
      const timeIdx = i - timeStartPosition;
      if (timeIdx >= 0 && timeIdx < TIME_SLOT_ORDER.length) {
        candidates[i].scores[TIME_SLOT_ORDER[timeIdx]] += POSITION_BOOST;
      }
    }
  }
}

function applyAmPmInfluence(candidates: ICandidate[], context: ISlotContext): void {
  if (!context.hasAmPm) {
    return;
  }

  let bestHourScore = -1;
  let bestHourIdx = -1;

  for (let i = 0; i < candidates.length; i++) {
    if (candidates[i].scores.hour > bestHourScore) {
      bestHourScore = candidates[i].scores.hour;
      bestHourIdx = i;
    }
  }

  if (bestHourIdx >= 0 && bestHourScore > SCORE_ZERO) {
    candidates[bestHourIdx].scores.hour += AMPM_BOOST;
  }
}

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
    for (let i = remaining.length - 1; i >= 0; i--) {
      const c = remaining[i];
      let certainSlot: ESlot | undefined;
      let allOthersLow = true;

      for (const slot of ALL_SLOTS) {
        if (assignedSlots.has(slot)) {
          continue;
        }
        if (c.scores[slot] >= CERTAIN_THRESHOLD) {
          certainSlot = slot;
        } else if (c.scores[slot] > CERTAIN_OTHER_MAX) {
          allOthersLow = false;
        }
      }

      if (!isNil(certainSlot) && allOthersLow) {
        result.set(c, certainSlot);
        assignedSlots.add(certainSlot);
        remaining.splice(i, 1);
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
    for (let i = remaining.length - 1; i >= 0; i--) {
      const c = remaining[i];
      let singleSlot: ESlot | undefined;
      let count = 0;

      for (const slot of ALL_SLOTS) {
        if (assignedSlots.has(slot)) {
          continue;
        }
        if (c.scores[slot] > SCORE_ZERO) {
          singleSlot = slot;
          count++;
        }
      }

      if (count === 1 && !isNil(singleSlot)) {
        result.set(c, singleSlot);
        assignedSlots.add(singleSlot);
        remaining.splice(i, 1);
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
    let bestIdx = -1;
    let bestSlot: ESlot = 'day';

    for (let i = 0; i < remaining.length; i++) {
      const c = remaining[i];
      for (const slot of ALL_SLOTS) {
        if (!assignedSlots.has(slot) && c.scores[slot] > bestScore) {
          bestScore = c.scores[slot];
          bestIdx = i;
          bestSlot = slot;
        }
      }
    }

    if (bestScore <= SCORE_ZERO || bestIdx < 0) {
      break;
    }

    const assigned = remaining[bestIdx];
    result.set(assigned, bestSlot);
    assignedSlots.add(bestSlot);
    remaining.splice(bestIdx, 1);
    zeroSlotInRemaining(remaining, bestSlot);
  }
}

function zeroSlotInRemaining(remaining: ICandidate[], slot: ESlot): void {
  for (const c of remaining) {
    c.scores[slot] = SCORE_ZERO;
  }
}

export function detectConflicts(tokens: IToken[]): string | undefined {
  const dateKeywords: IToken[] = [];
  const timeKeywords: IToken[] = [];
  const colonTimes: IToken[] = [];
  const offsets: IToken[] = [];
  const durations: IToken[] = [];
  const monthNames: IToken[] = [];

  for (const token of tokens) {
    switch (token.kind) {
      case ETokenKind.Keyword:
        dateKeywords.push(token);
        break;
      case ETokenKind.TimeKeyword:
        timeKeywords.push(token);
        break;
      case ETokenKind.Offset:
        offsets.push(token);
        break;
      case ETokenKind.Duration:
        durations.push(token);
        break;
      case ETokenKind.ColonTime:
        colonTimes.push(token);
        break;
      case ETokenKind.MonthName:
        monthNames.push(token);
        break;
      default:
        break;
    }
  }

  if (dateKeywords.length > 1) {
    return `Conflicting date keywords: "${dateKeywords[0].raw}" and "${dateKeywords[1].raw}"`;
  }

  const allTimeSources = [...timeKeywords, ...colonTimes];
  if (allTimeSources.length > 1) {
    return `Conflicting time specifications: "${allTimeSources[0].raw}" and "${allTimeSources[1].raw}"`;
  }

  if (dateKeywords.length > 0 && (offsets.length > 0 || durations.length > 0)) {
    const conflicting = offsets.length > 0 ? offsets[0] : durations[0];
    return `Cannot combine date keyword "${dateKeywords[0].raw}" with offset/duration "${conflicting.raw}"`;
  }

  if (monthNames.length > 1) {
    return `Conflicting month names: "${monthNames[0].raw}" and "${monthNames[1].raw}"`;
  }

  return undefined;
}

export function buildSlotContext(tokens: IToken[]): ISlotContext {
  return {
    hasDateKeyword: tokens.some(t => t.kind === ETokenKind.Keyword),
    hasBoundaryKeyword: tokens.some(t => t.kind === ETokenKind.BoundaryKeyword),
    hasMonthName: tokens.some(t => t.kind === ETokenKind.MonthName),
    hasTimeKeyword: tokens.some(t => t.kind === ETokenKind.TimeKeyword),
    hasColonTime: tokens.some(t => t.kind === ETokenKind.ColonTime),
    hasOrdinal: tokens.some(t => t.kind === ETokenKind.Ordinal),
    hasAmPm: tokens.some(t => t.kind === ETokenKind.AmPm),
  };
}
