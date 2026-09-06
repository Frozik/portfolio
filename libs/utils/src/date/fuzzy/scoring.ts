import { isNil } from 'lodash-es';

import {
  ADJACENCY_BOOST,
  AMPM_BOOST,
  CERTAIN_THRESHOLD,
  HOURS_IN_DAY,
  MIN_3_DIGIT_VALUE,
  MIN_4_DIGIT_YEAR,
  MIN_NON_DAY_VALUE,
  MIN_TWO_DIGIT_YEAR_VALUE,
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
import { ALL_SLOTS, ETokenKind } from './types';

export function isWeekdayKeyword(token: IToken): boolean {
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

  if (value >= MIN_3_DIGIT_VALUE) {
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

  if (value >= MIN_TWO_DIGIT_YEAR_VALUE) {
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

  if (value >= MIN_NON_DAY_VALUE) {
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
