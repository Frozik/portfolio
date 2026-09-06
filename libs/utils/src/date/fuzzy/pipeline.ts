import { isNil } from 'lodash-es';
import type { Temporal } from 'temporal-polyfill';
import {
  HOURS_IN_DAY,
  MAX_TOKEN_COUNT,
  MIN_4_DIGIT_YEAR,
  MONTHS_IN_YEAR,
  NOON_HOUR,
} from './constants';
import { tryParseISODateTime } from './iso-datetime';
import type { IPipelineResult } from './pipeline-result';
import {
  resolveMonthNameToSlots,
  resolveOrdinalDaySlots,
  resolvePartialDayMonthNumericSlots,
} from './resolvers';
import { applyContextRules, tagCandidates } from './scoring';
import { applySeparatorContext } from './separator-context';
import { buildSlotContext, detectConflicts } from './slot-context';
import { resolveSlots } from './slot-resolution';
import {
  buildTimeSlots,
  normalizeYear,
  slotsToPlainDate,
  slotsToPlainTime,
  tryBuildDateSlots,
} from './slots';
import { deriveTemporality } from './temporality';
import { collectTokenBase } from './token-base';
import { fsmTokenize, tokenize } from './tokenizer';
import type { ISlotContext, IToken } from './types';
import { ETokenKind } from './types';

export function parseFullPipeline(
  input: string,
  today: Temporal.PlainDate,
  timeZone: string
): IPipelineResult | undefined {
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return undefined;
  }

  // ISO datetime is the only special case - T separator breaks FSM tokenization
  // Use Temporal API directly (no regex)
  const isoResult = tryParseISODateTime(trimmed, timeZone);
  if (!isNil(isoResult)) {
    return isoResult;
  }

  // FSM-based token pipeline - handles everything else
  return resolveWithFsmPipeline(trimmed, today, timeZone);
}

/**
 * Unified FSM-based token pipeline.
 * Uses the FSM tokenizer to produce separator-aware tokens,
 * then applies probabilistic scoring and separator context.
 */
function resolveWithFsmPipeline(
  input: string,
  today: Temporal.PlainDate,
  timeZone: string
): IPipelineResult | undefined {
  // FSM tokenize to get separator-aware tokens
  const fsmTokens = fsmTokenize(input);

  // Filter out separators for the existing token pipeline
  const fsmFiltered = fsmTokens.filter(token => token.kind !== ETokenKind.Separator);

  // Also try with the legacy tokenizer for backward compatibility
  const legacyTokens = tokenize(input);

  // Use whichever token stream has fewer unknowns
  const tokens = chooseBestTokenStream(fsmFiltered, legacyTokens);

  return runTokenPipeline(tokens, fsmTokens, today, timeZone);
}

function chooseBestTokenStream(fsmFiltered: IToken[], legacy: IToken[]): IToken[] {
  const fsmUnknowns = fsmFiltered.filter(token => token.kind === ETokenKind.Unknown).length;
  const legacyUnknowns = legacy.filter(token => token.kind === ETokenKind.Unknown).length;

  if (fsmUnknowns < legacyUnknowns) {
    return fsmFiltered;
  }
  if (legacyUnknowns < fsmUnknowns) {
    return legacy;
  }

  return legacy;
}

function runTokenPipeline(
  tokens: IToken[],
  fsmTokens: IToken[],
  today: Temporal.PlainDate,
  timeZone: string
): IPipelineResult | undefined {
  if (tokens.some(token => token.kind === ETokenKind.Unknown)) {
    return undefined;
  }

  if (tokens.length === 0 || tokens.length > MAX_TOKEN_COUNT) {
    return undefined;
  }

  const conflict = detectConflicts(tokens);
  if (!isNil(conflict)) {
    return undefined;
  }

  const fsmContext = buildSlotContext(fsmTokens);
  const context: ISlotContext = {
    ...fsmContext,
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
      token =>
        token.kind === ETokenKind.WeekdayName ||
        (token.kind === ETokenKind.Keyword &&
          !isNil(token.extra) &&
          token.extra.startsWith('weekday:'))
    ),
    hasQuarter: tokens.some(token => token.kind === ETokenKind.Quarter),
  };

  const base = collectTokenBase(tokens, today);
  const { baseDate, amPmValue } = base;
  let { baseTime, knownMonth, knownDay } = base;
  let knownYear: number | undefined;

  const candidates = tagCandidates(tokens, context);
  applyContextRules(candidates, tokens, context);
  applySeparatorContext(candidates, fsmTokens);

  const assignments = resolveSlots(candidates);
  if (isNil(assignments)) {
    return undefined;
  }

  for (const [candidate, slot] of assignments) {
    switch (slot) {
      case 'year':
        knownYear =
          candidate.token.value >= MIN_4_DIGIT_YEAR
            ? candidate.token.value
            : normalizeYear(String(candidate.token.value));
        break;
      case 'month':
        knownMonth = candidate.token.value;
        break;
      case 'day':
        knownDay = candidate.token.value;
        break;
      case 'hour':
      case 'minute':
      case 'second':
      case 'ms':
        break;
    }
  }

  // When we have year + day but no month, and the day value is a valid month (1-12),
  // reassign it as month. This handles patterns like "01/2027" (month/year).
  if (
    !isNil(knownYear) &&
    !isNil(knownDay) &&
    isNil(knownMonth) &&
    !context.hasMonthName &&
    knownDay >= 1 &&
    knownDay <= MONTHS_IN_YEAR
  ) {
    knownMonth = knownDay;
    knownDay = undefined;
    for (const [candidate, slot] of assignments) {
      if (slot === 'day') {
        assignments.set(candidate, 'month');
        break;
      }
    }
  }

  // When a candidate was assigned to "hour" but its value exceeds valid hour range
  // and no year has been resolved yet, reassign it as a 2-digit year.
  // This handles patterns like "15 jan 27" where 27 can't be an hour.
  if (isNil(knownYear) && context.hasMonthName) {
    for (const [candidate, slot] of assignments) {
      if (slot === 'hour' && candidate.token.value >= HOURS_IN_DAY) {
        knownYear = normalizeYear(String(candidate.token.value));
        assignments.set(candidate, 'year');
        break;
      }
    }
  }

  if (isNil(baseTime)) {
    let hour: number | undefined;
    let minute = 0;
    let second = 0;
    let ms = 0;

    for (const [candidate, slot] of assignments) {
      switch (slot) {
        case 'hour':
          hour = candidate.token.value;
          break;
        case 'minute':
          minute = candidate.token.value;
          break;
        case 'second':
          second = candidate.token.value;
          break;
        case 'ms':
          ms = candidate.token.value;
          break;
        default:
          break;
      }
    }

    if (!isNil(hour) && !isNil(amPmValue)) {
      if (amPmValue === NOON_HOUR) {
        hour = hour === NOON_HOUR ? NOON_HOUR : hour + NOON_HOUR;
      } else {
        hour = hour === NOON_HOUR ? 0 : hour;
      }
    }

    if (!isNil(hour)) {
      const builtTimeSlots = buildTimeSlots(hour, minute, second, ms);
      baseTime = isNil(builtTimeSlots) ? undefined : slotsToPlainTime(builtTimeSlots);
    }
  }

  let resultDate: Temporal.PlainDate | undefined = baseDate;

  if (isNil(resultDate)) {
    if (!isNil(knownMonth) && !isNil(knownDay)) {
      if (!isNil(knownYear)) {
        const resolvedDateSlots = tryBuildDateSlots(knownYear, knownMonth, knownDay);
        resultDate = isNil(resolvedDateSlots) ? undefined : slotsToPlainDate(resolvedDateSlots);
      } else {
        const partialDateSlots = resolvePartialDayMonthNumericSlots(knownDay, knownMonth, today);
        resultDate = isNil(partialDateSlots) ? undefined : slotsToPlainDate(partialDateSlots);
      }
    } else if (!isNil(knownMonth) && !isNil(knownYear) && isNil(knownDay)) {
      // Month + year without day (e.g., "jan 2027", "2027 jan")
      const monthYearSlots = tryBuildDateSlots(knownYear, knownMonth, 1);
      resultDate = isNil(monthYearSlots) ? undefined : slotsToPlainDate(monthYearSlots);
    } else if (!isNil(knownMonth) && isNil(knownDay) && isNil(knownYear)) {
      // Month-only (e.g., "jan", "december")
      const monthOnlySlots = resolveMonthNameToSlots(getMonthNameFromTokens(tokens) ?? '', today);
      resultDate = isNil(monthOnlySlots) ? undefined : slotsToPlainDate(monthOnlySlots);
    } else if (!isNil(knownDay) && isNil(knownMonth)) {
      const ordinalSlots = resolveOrdinalDaySlots(knownDay, today);
      resultDate = isNil(ordinalSlots) ? undefined : slotsToPlainDate(ordinalSlots);
    } else if (!isNil(baseTime) && isNil(knownMonth) && isNil(knownDay)) {
      resultDate = today;
    }
  }

  if (isNil(resultDate)) {
    return undefined;
  }

  const temporality = deriveTemporality(tokens, !isNil(knownYear));

  if (!isNil(baseTime)) {
    return {
      value: resultDate.toZonedDateTime({
        timeZone,
        plainTime: baseTime,
      }),
      temporality,
    };
  }

  return {
    value: resultDate.toZonedDateTime(timeZone),
    temporality,
  };
}

function getMonthNameFromTokens(tokens: IToken[]): string | undefined {
  const monthToken = tokens.find(token => token.kind === ETokenKind.MonthName);
  return isNil(monthToken) ? undefined : monthToken.raw;
}
