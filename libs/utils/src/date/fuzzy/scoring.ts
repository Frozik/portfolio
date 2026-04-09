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
import type { ESlot, ICandidate, ISlotContext, IToken } from './types';
import { ALL_SLOTS, ESeparatorKind, ETokenKind } from './types';

function isWeekdayKeyword(token: IToken): boolean {
  return (
    token.kind === ETokenKind.Keyword && !isNil(token.extra) && token.extra.startsWith('weekday:')
  );
}

/** Whether the date is fully determined by a non-numeric token (keyword, boundary, offset, weekday, quarter) */
function hasFullDateContext(context: ISlotContext): boolean {
  return (
    context.hasDateKeyword || context.hasBoundaryKeyword || context.hasOffset || context.hasWeekday
  );
}

export function tagCandidates(tokens: IToken[], _context: ISlotContext): ICandidate[] {
  const candidates: ICandidate[] = [];

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (token.kind === ETokenKind.Number || token.kind === ETokenKind.Ordinal) {
      candidates.push({
        token,
        index,
        scores: { ...getBaseScores(token.value) },
      });
    }
  }

  return candidates;
}

function getBaseScores(value: number): Record<ESlot, number> {
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
  applyCertainSlotElimination(candidates);
  applyKnownSlotElimination(candidates, context);
  applyMonthAdjacency(candidates, tokens);
  applyPositionRules(candidates, tokens, context);
  applyAmPmInfluence(candidates, context);
}

/**
 * When a candidate has SCORE_CERTAIN for a slot, zero that slot
 * in all other candidates before applying context boosts.
 * This prevents position/adjacency boosts from competing
 * with already-certain assignments (e.g., 4-digit year, 3-digit ms).
 */
function applyCertainSlotElimination(candidates: ICandidate[]): void {
  for (const candidate of candidates) {
    for (const slot of ALL_SLOTS) {
      if (candidate.scores[slot] >= CERTAIN_THRESHOLD) {
        for (const other of candidates) {
          if (other !== candidate) {
            other.scores[slot] = SCORE_ZERO;
          }
        }
      }
    }
  }
}

function applyKnownSlotElimination(candidates: ICandidate[], context: ISlotContext): void {
  if (context.hasMonthName) {
    for (const candidate of candidates) {
      candidate.scores.month = SCORE_ZERO;
    }
  }

  if (hasFullDateContext(context)) {
    for (const candidate of candidates) {
      candidate.scores.day = SCORE_ZERO;
      candidate.scores.month = SCORE_ZERO;
      candidate.scores.year = SCORE_ZERO;
    }
  }

  if (context.hasColonTime || context.hasTimeKeyword) {
    for (const candidate of candidates) {
      candidate.scores.hour = SCORE_ZERO;
      candidate.scores.minute = SCORE_ZERO;
      candidate.scores.second = SCORE_ZERO;
      candidate.scores.ms = SCORE_ZERO;
    }
  }

  if (context.hasOrdinal && !context.hasMonthName) {
    // Ordinal alone (e.g., "15th 9") fills the day — remaining numbers are time
    for (const candidate of candidates) {
      if (candidate.token.kind === ETokenKind.Number) {
        candidate.scores.day = SCORE_ZERO;
        candidate.scores.month = SCORE_ZERO;
        candidate.scores.year = SCORE_ZERO;
      }
    }
  }

  if (context.hasQuarter) {
    // Quarter fills the date — remaining non-year numbers are time
    for (const candidate of candidates) {
      if (candidate.scores.year < CERTAIN_THRESHOLD) {
        candidate.scores.day = SCORE_ZERO;
        candidate.scores.month = SCORE_ZERO;
      }
    }
  }
}

function applyMonthAdjacency(candidates: ICandidate[], tokens: IToken[]): void {
  for (const candidate of candidates) {
    const tokenIndex = candidate.index;

    if (tokenIndex > 0 && tokens[tokenIndex - 1].kind === ETokenKind.MonthName) {
      candidate.scores.day += ADJACENCY_BOOST;
    }

    if (tokenIndex < tokens.length - 1 && tokens[tokenIndex + 1].kind === ETokenKind.MonthName) {
      candidate.scores.day += ADJACENCY_BOOST;
    }
  }
}

const TIME_SLOT_ORDER: readonly ESlot[] = ['hour', 'minute', 'second', 'ms'];

function isAdjacentToMonthName(tokenIndex: number, tokens: IToken[]): boolean {
  return (
    (tokenIndex > 0 && tokens[tokenIndex - 1].kind === ETokenKind.MonthName) ||
    (tokenIndex < tokens.length - 1 && tokens[tokenIndex + 1].kind === ETokenKind.MonthName)
  );
}

function applyPositionRules(
  candidates: ICandidate[],
  tokens: IToken[],
  context: ISlotContext
): void {
  if (
    hasFullDateContext(context) ||
    (context.hasOrdinal && !context.hasMonthName) ||
    context.hasQuarter
  ) {
    // Date is fully determined — Number candidates are time components
    // (except 4-digit years which stay as year, and ordinals which stay as day)
    let timeIndex = 0;
    for (let index = 0; index < candidates.length; index++) {
      if (candidates[index].token.kind === ETokenKind.Ordinal) {
        candidates[index].scores.day += POSITION_BOOST;
        continue;
      }
      if (candidates[index].scores.year >= SCORE_VERY_HIGH) {
        candidates[index].scores.year += POSITION_BOOST;
        continue;
      }
      if (timeIndex < TIME_SLOT_ORDER.length) {
        candidates[index].scores[TIME_SLOT_ORDER[timeIndex]] += POSITION_BOOST;
      }
      timeIndex++;
    }
    return;
  }

  if (context.hasMonthName) {
    // Check if day is "spoken for" at a later position (e.g., "11 10 10nov").
    // Only applies when the first candidate is NOT adjacent to MonthName
    // but a later candidate IS — meaning day comes after time components.
    const firstAdjacentToMonth =
      candidates.length > 0 && isAdjacentToMonthName(candidates[0].index, tokens);
    const dayClaimedByLater =
      !firstAdjacentToMonth &&
      candidates.some(
        (candidate, candidateIndex) =>
          candidateIndex > 0 && isAdjacentToMonthName(candidate.index, tokens)
      );
    const firstIsDay = !context.hasOrdinal && !dayClaimedByLater;

    let timeSlotIndex = 0;
    for (let index = 0; index < candidates.length; index++) {
      if (index === 0 && firstIsDay) {
        candidates[index].scores.day += POSITION_BOOST;
      } else if (candidates[index].scores.year >= SCORE_VERY_HIGH) {
        // Candidate is almost certainly a year (value >= 60) —
        // boost year instead of consuming a time position slot
        candidates[index].scores.year += POSITION_BOOST;
      } else {
        const effectiveTimeIndex = context.hasOrdinal ? index : timeSlotIndex;
        if (effectiveTimeIndex < TIME_SLOT_ORDER.length) {
          candidates[index].scores[TIME_SLOT_ORDER[effectiveTimeIndex]] += POSITION_BOOST;
        }
        timeSlotIndex++;
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

  for (let index = 0; index < candidates.length; index++) {
    if (index < dateSlots.length) {
      candidates[index].scores[dateSlots[index]] += POSITION_BOOST;
    } else {
      const timeSlotIndex = index - timeStartPosition;
      if (timeSlotIndex >= 0 && timeSlotIndex < TIME_SLOT_ORDER.length) {
        candidates[index].scores[TIME_SLOT_ORDER[timeSlotIndex]] += POSITION_BOOST;
      }
    }
  }
}

function applyAmPmInfluence(candidates: ICandidate[], context: ISlotContext): void {
  if (!context.hasAmPm) {
    return;
  }

  let bestHourScore = -1;
  let bestHourIndex = -1;

  for (let index = 0; index < candidates.length; index++) {
    if (candidates[index].scores.hour > bestHourScore) {
      bestHourScore = candidates[index].scores.hour;
      bestHourIndex = index;
    }
  }

  if (bestHourIndex >= 0 && bestHourScore > SCORE_ZERO) {
    candidates[bestHourIndex].scores.hour += AMPM_BOOST;
  }
}

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
  let colonCount = 0;
  let datePartCount = 0;
  let hasDotAfterColon = false;
  let seenColon = false;

  for (const token of tokens) {
    if (token.kind === ETokenKind.Separator) {
      if (token.raw === ESeparatorKind.Colon) {
        colonCount++;
        seenColon = true;
      } else if (
        token.raw === ESeparatorKind.Dash ||
        token.raw === ESeparatorKind.Slash ||
        token.raw === ESeparatorKind.Dot
      ) {
        if (seenColon && token.raw === ESeparatorKind.Dot) {
          hasDotAfterColon = true;
        } else {
          datePartCount++;
        }
      }
    }
  }

  return {
    hasDateKeyword: tokens.some(token => token.kind === ETokenKind.Keyword),
    hasBoundaryKeyword: tokens.some(token => token.kind === ETokenKind.BoundaryKeyword),
    hasMonthName: tokens.some(token => token.kind === ETokenKind.MonthName),
    hasTimeKeyword: tokens.some(token => token.kind === ETokenKind.TimeKeyword),
    hasColonTime: tokens.some(token => token.kind === ETokenKind.ColonTime),
    hasOrdinal: tokens.some(token => token.kind === ETokenKind.Ordinal),
    hasAmPm: tokens.some(token => token.kind === ETokenKind.AmPm),
    hasOffset: tokens.some(
      token => token.kind === ETokenKind.Offset || token.kind === ETokenKind.Duration
    ),
    hasWeekday: tokens.some(
      token => token.kind === ETokenKind.WeekdayName || isWeekdayKeyword(token)
    ),
    hasQuarter: tokens.some(token => token.kind === ETokenKind.Quarter),
    colonCount,
    datePartCount,
    hasDotAfterColon,
  };
}
