import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';
import {
  COLON_TIME_PARTS_MIN,
  COLON_TIME_PARTS_WITH_MS,
  HOURS_IN_DAY,
  MAX_TOKEN_COUNT,
  MIN_4_DIGIT_YEAR,
  MONTHS_IN_YEAR,
  NOON_HOUR,
} from './constants';
import {
  applyOffsetSlots,
  resolveBoundaryKeywordToSlots,
  resolveKeywordToDateSlots,
  resolveMonthNameToSlots,
  resolveNextWeekdaySlots,
  resolveOrdinalDaySlots,
  resolvePartialDayMonthNumericSlots,
  resolveQuarterFromToken,
  resolveTimeKeywordToSlots,
} from './resolvers';
import {
  applyContextRules,
  applySeparatorContext,
  buildSlotContext,
  detectConflicts,
  resolveSlots,
  tagCandidates,
} from './scoring';
import {
  buildTimeSlots,
  normalizeYear,
  slotsToPlainDate,
  slotsToPlainTime,
  tryBuildDateSlots,
} from './slots';
import { fsmTokenize, tokenize } from './tokenizer';
import type { ISlotContext, IToken } from './types';
import { EParseTemporality, ETokenKind } from './types';

export interface IPipelineResult {
  readonly value: Temporal.ZonedDateTime;
  readonly temporality: EParseTemporality;
}

const ISO_DATE_LENGTH = 10; // "YYYY-MM-DD".length
const ISO_YEAR_SEPARATOR_INDEX = 4; // position of first '-' in ISO date

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

function tryParseISODateTime(input: string, timeZone: string): IPipelineResult | undefined {
  // Quick check: ISO dates are at least 10 chars and have '-' at position 4
  if (input.length < ISO_DATE_LENGTH || input[ISO_YEAR_SEPARATOR_INDEX] !== '-') {
    return undefined;
  }

  try {
    if (input.includes('T')) {
      const zonedDateTime = Temporal.ZonedDateTime.from(`${input}[${timeZone}]`);
      return { value: zonedDateTime, temporality: EParseTemporality.ExplicitDate };
    }
    // Try ISO date "YYYY-MM-DD" (exactly 10 chars)
    if (input.length === ISO_DATE_LENGTH) {
      const date = Temporal.PlainDate.from(input);
      return {
        value: date.toZonedDateTime(timeZone),
        temporality: EParseTemporality.ExplicitDate,
      };
    }
  } catch {
    // Not valid ISO format, fall through to FSM
  }
  return undefined;
}

export function parseTokenBased(
  input: string,
  today: Temporal.PlainDate,
  timeZone: string
): Temporal.ZonedDateTime | undefined {
  const result = resolveWithFsmPipeline(input, today, timeZone);
  if (isNil(result)) {
    return undefined;
  }
  return result.value;
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

function deriveTemporality(tokens: IToken[], hasResolvedYear: boolean): EParseTemporality {
  for (const token of tokens) {
    switch (token.kind) {
      case ETokenKind.Keyword: {
        const keyword = token.raw.toLowerCase();
        if (keyword === 'yesterday') {
          return EParseTemporality.PastDirected;
        }
        if (
          keyword === 'tomorrow' ||
          keyword === 'tom' ||
          keyword === 'today' ||
          keyword === 'now'
        ) {
          return EParseTemporality.FutureDirected;
        }
        // "next/last weekday" merged keyword
        if (!isNil(token.extra) && token.extra.startsWith('weekday:')) {
          return token.value === 1 ? EParseTemporality.Weekday : EParseTemporality.PastDirected;
        }
        break;
      }
      case ETokenKind.TimeKeyword:
        return EParseTemporality.KeywordTime;
      case ETokenKind.BoundaryKeyword:
        return EParseTemporality.Boundary;
      case ETokenKind.Offset: {
        return token.value < 0 ? EParseTemporality.PastDirected : EParseTemporality.FutureDirected;
      }
      case ETokenKind.Duration:
        return EParseTemporality.FutureDirected;
      default:
        break;
    }
  }

  const hasWeekday = tokens.some(token => token.kind === ETokenKind.WeekdayName);
  if (hasWeekday) {
    return EParseTemporality.Weekday;
  }

  const hasMonthName = tokens.some(token => token.kind === ETokenKind.MonthName);
  const hasOrdinal = tokens.some(token => token.kind === ETokenKind.Ordinal);
  const hasNumber = tokens.some(token => token.kind === ETokenKind.Number);
  const hasQuarter = tokens.some(token => token.kind === ETokenKind.Quarter);
  const hasColonTime = tokens.some(token => token.kind === ETokenKind.ColonTime);

  // Standalone time: only time-related tokens, no date components
  if (hasColonTime && !hasMonthName && !hasOrdinal && !hasNumber && !hasQuarter && !hasWeekday) {
    return EParseTemporality.TimeOnly;
  }

  if (hasQuarter && !hasResolvedYear) {
    return EParseTemporality.Quarter;
  }

  if (hasMonthName && (hasOrdinal || hasNumber) && !hasResolvedYear) {
    // Month + day without explicit year
    return EParseTemporality.MonthDay;
  }

  if (hasOrdinal && !hasMonthName) {
    return EParseTemporality.DayOfMonth;
  }

  if (hasMonthName && !hasOrdinal && !hasNumber) {
    return EParseTemporality.MonthOnly;
  }

  return EParseTemporality.ExplicitDate;
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

  let baseDate: Temporal.PlainDate | undefined;
  let baseTime: Temporal.PlainTime | undefined;
  let knownMonth: number | undefined;
  let knownDay: number | undefined;
  let knownYear: number | undefined;
  let amPmValue: number | undefined;

  for (const token of tokens) {
    switch (token.kind) {
      case ETokenKind.Keyword: {
        const keywordSlots = resolveKeywordToDateSlots(token, today);
        if (!isNil(keywordSlots)) {
          const keywordDate = slotsToPlainDate(keywordSlots);
          if (!isNil(keywordDate)) {
            baseDate = keywordDate;
          }
          const keywordTime = slotsToPlainTime(keywordSlots);
          if (!isNil(keywordTime)) {
            baseTime = keywordTime;
          }
        }
        break;
      }
      case ETokenKind.TimeKeyword: {
        const timeKeywordSlots = resolveTimeKeywordToSlots(token.raw.toLowerCase());
        if (!isNil(timeKeywordSlots)) {
          const timeKeywordTime = slotsToPlainTime(timeKeywordSlots);
          if (!isNil(timeKeywordTime)) {
            baseTime = timeKeywordTime;
          }
        }
        break;
      }
      case ETokenKind.BoundaryKeyword: {
        const boundarySlots = resolveBoundaryKeywordToSlots(token.raw.toLowerCase(), today);
        if (!isNil(boundarySlots)) {
          const boundaryDate = slotsToPlainDate(boundarySlots);
          if (!isNil(boundaryDate)) {
            baseDate = boundaryDate;
          }
        }
        break;
      }
      case ETokenKind.MonthName:
        knownMonth = token.value;
        break;
      case ETokenKind.ColonTime: {
        const parts = splitOnColonAndDot(token.extra);
        if (!isNil(parts) && parts.length >= COLON_TIME_PARTS_MIN) {
          const colonTimeSlots = buildTimeSlots(
            Number(parts[0]),
            Number(parts[1]),
            parts.length > 2 ? Number(parts[2]) : 0,
            parts.length > COLON_TIME_PARTS_WITH_MS ? Number(parts[COLON_TIME_PARTS_WITH_MS]) : 0
          );
          if (!isNil(colonTimeSlots)) {
            const colonTime = slotsToPlainTime(colonTimeSlots);
            if (!isNil(colonTime)) {
              baseTime = colonTime;
            }
          }
        }
        break;
      }
      case ETokenKind.Ordinal:
        knownDay = token.value;
        break;
      case ETokenKind.AmPm:
        amPmValue = token.value;
        break;
      case ETokenKind.Offset: {
        const offsetUnit = token.extra ?? 'd';
        const offsetDirection = token.value >= 0 ? 1 : -1;
        const offsetSlots = applyOffsetSlots(
          today,
          Math.abs(token.value),
          offsetUnit,
          offsetDirection
        );
        const offsetDate = slotsToPlainDate(offsetSlots);
        if (!isNil(offsetDate)) {
          baseDate = offsetDate;
        }
        break;
      }
      case ETokenKind.Duration: {
        const durationUnit = token.extra ?? 'd';
        const durationSlots = applyOffsetSlots(today, token.value, durationUnit, 1);
        const durationDate = slotsToPlainDate(durationSlots);
        if (!isNil(durationDate)) {
          baseDate = durationDate;
        }
        break;
      }
      case ETokenKind.WeekdayName: {
        const weekdaySlots = resolveNextWeekdaySlots(token.raw.toLowerCase(), today);
        const weekdayDate = isNil(weekdaySlots) ? undefined : slotsToPlainDate(weekdaySlots);
        if (!isNil(weekdayDate)) {
          baseDate = weekdayDate;
        }
        break;
      }
      case ETokenKind.Quarter: {
        const result = resolveQuarterFromToken(token, tokens, today);
        if (!isNil(result)) {
          baseDate = result;
        }
        break;
      }
      default:
        break;
    }
  }

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

function splitOnColonAndDot(value: string | undefined): string[] | undefined {
  if (isNil(value)) {
    return undefined;
  }
  const result: string[] = [];
  let current = '';
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (char === ':' || char === '.') {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function getMonthNameFromTokens(tokens: IToken[]): string | undefined {
  const monthToken = tokens.find(token => token.kind === ETokenKind.MonthName);
  return isNil(monthToken) ? undefined : monthToken.raw;
}
