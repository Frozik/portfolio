import { Temporal } from '@js-temporal/polyfill';
import { isNil } from 'lodash-es';
import {
  applyContextRules,
  buildSlotContext,
  detectConflicts,
  resolveSlots,
  tagCandidates,
} from './candidate-resolver';
import {
  COLON_TIME_PARTS_MIN,
  COLON_TIME_PARTS_WITH_MS,
  MAX_TOKEN_COUNT,
  MAX_UNIVERSAL_PARTS,
  MIN_4_DIGIT_YEAR,
  MIN_UNIVERSAL_PARTS,
  NOON_HOUR,
  UNIVERSAL_DAY_INDEX,
  UNIVERSAL_HOUR_INDEX,
  UNIVERSAL_MINUTE_INDEX,
  UNIVERSAL_MONTH_INDEX,
  UNIVERSAL_MS_INDEX,
  UNIVERSAL_SECOND_INDEX,
  UNIVERSAL_YEAR_INDEX,
} from './constants';
import {
  resolveBoundaryKeywordToSlots,
  resolveKeywordToDateSlots,
  resolveMonthNameToSlots,
  resolveMonthYearToSlots,
  resolveQuarterFromToken,
  resolveTimeKeywordToSlots,
  tryParseDirectDateSlots,
  tryParseISOSlots,
  tryParseStandaloneTimeSlots,
  tryResolveKeyword,
} from './date-resolvers';
import {
  AMPM_SUFFIX_REGEX,
  BARE_TIME_SUFFIX_REGEX,
  DAY_MONTH_REGEX,
  DAY_MONTH_YEAR_REGEX,
  DURATION_FULL_REGEX,
  IN_N_UNITS_REGEX,
  ISO_MONTH_REGEX,
  MONTH_DAY_REGEX,
  MONTH_DAY_YEAR_REGEX,
  MONTH_NAME_REGEX,
  MONTH_YEAR_REGEX,
  N_UNITS_AGO_REGEX,
  NEXT_LAST_WEEKDAY_REGEX,
  NUMERIC_SPACE_DATE_REGEX,
  OFFSET_REGEX,
  ORDINAL_DAY_REGEX,
  QUARTER_NQ_FULL_REGEX,
  QUARTER_Q_FULL_REGEX,
  SLASH_MONTH_REGEX,
  TIME_SUFFIX_REGEX,
  YEAR_MONTH_REGEX,
} from './patterns';
import {
  applyOffsetSlots,
  applyTimeSlotsToZDT,
  assembleZDT,
  buildTimeSlots,
  convertAmPmHour,
  isAmbiguousHour,
  mergeSlots,
  normalizeMilliseconds,
  normalizeYear,
  resolveNextWeekdaySlots,
  resolveOrdinalDaySlots,
  resolvePartialDayMonthNumericSlots,
  resolvePartialDayMonthSlots,
  resolvePreviousWeekdaySlots,
  resolveQuarterSlots,
  slotsToPlainDate,
  slotsToPlainTime,
  tryBuildDateFromName,
  tryBuildDateSlots,
} from './slot-utils';
import type { ISlotMap } from './token-types';
import { ETokenKind } from './token-types';
import { tokenize } from './tokenizer';
import { EParseTemporality } from './types';

export interface IPipelineResult {
  readonly value: Temporal.ZonedDateTime;
  readonly temporality: EParseTemporality;
}

function tryResolveKeywordWithTemporality(
  keyword: string,
  today: Temporal.PlainDate,
  timeZone: string
): IPipelineResult | undefined {
  const lower = keyword.toLowerCase();

  const temporality = getKeywordTemporality(lower);
  if (isNil(temporality)) {
    return undefined;
  }

  const value = tryResolveKeyword(lower, today, timeZone);
  if (isNil(value)) {
    return undefined;
  }

  return { value, temporality };
}

function getKeywordTemporality(keyword: string): EParseTemporality | undefined {
  switch (keyword) {
    case 'yesterday':
      return EParseTemporality.PastDirected;
    case 'tomorrow':
    case 'tom':
    case 'today':
    case 'now':
      return EParseTemporality.FutureDirected;
    case 'noon':
    case 'midday':
    case 'midnight':
      return EParseTemporality.KeywordTime;
    case 'eom':
    case 'end of month':
    case 'end-of-month':
    case 'bom':
    case 'som':
    case 'beginning of month':
    case 'start of month':
    case 'start-of-month':
    case 'eoy':
    case 'end of year':
    case 'end-of-year':
    case 'boy':
    case 'soy':
    case 'beginning of year':
    case 'start of year':
    case 'start-of-year':
    case 'eoq':
    case 'end of quarter':
    case 'end-of-quarter':
      return EParseTemporality.Boundary;
    default:
      return undefined;
  }
}

export function parseFullPipeline(
  input: string,
  today: Temporal.PlainDate,
  timeZone: string
): IPipelineResult | undefined {
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return undefined;
  }

  const standaloneTimeSlots = tryParseStandaloneTimeSlots(trimmed);
  if (!isNil(standaloneTimeSlots)) {
    const plainTime = slotsToPlainTime(standaloneTimeSlots);
    if (!isNil(plainTime)) {
      return {
        value: today.toZonedDateTime({ timeZone, plainTime }),
        temporality: EParseTemporality.TimeOnly,
      };
    }
  }

  const isoSlots = tryParseISOSlots(trimmed, timeZone);
  if (!isNil(isoSlots)) {
    const isoZdt = assembleZDT(isoSlots, today, timeZone);
    if (!isNil(isoZdt)) {
      return { value: isoZdt, temporality: EParseTemporality.ExplicitDate };
    }
  }

  const directSlots = tryParseDirectDateSlots(trimmed);
  if (!isNil(directSlots)) {
    const directZdt = assembleZDT(directSlots, today, timeZone);
    if (!isNil(directZdt)) {
      return { value: directZdt, temporality: EParseTemporality.ExplicitDate };
    }
  }

  const timeSplitResult = tryParseDateWithTimeSuffix(trimmed, today, timeZone);
  if (!isNil(timeSplitResult)) {
    return timeSplitResult;
  }

  const dateOnlyResult = tryParseDateOnly(trimmed, today, timeZone);
  if (!isNil(dateOnlyResult)) {
    return dateOnlyResult;
  }

  const bareTimeSplitResult = tryParseDateWithBareTimeSuffix(trimmed, today, timeZone);
  if (!isNil(bareTimeSplitResult)) {
    return bareTimeSplitResult;
  }

  const universalSlots = tryParseUniversalNumericSlots(trimmed);
  if (!isNil(universalSlots)) {
    const universalZdt = assembleZDT(universalSlots, today, timeZone);
    if (!isNil(universalZdt)) {
      return { value: universalZdt, temporality: EParseTemporality.ExplicitDate };
    }
  }

  const tokenResult = parseTokenBased(trimmed, today, timeZone);
  if (!isNil(tokenResult)) {
    return { value: tokenResult, temporality: EParseTemporality.ExplicitDate };
  }

  return undefined;
}

export function parseTokenBased(
  input: string,
  today: Temporal.PlainDate,
  timeZone: string
): Temporal.ZonedDateTime | undefined {
  return tryParseTokenPipeline(input, today, timeZone);
}

function tryParseDateOnly(
  trimmed: string,
  today: Temporal.PlainDate,
  timeZone: string
): IPipelineResult | undefined {
  function toZDT(date: Temporal.PlainDate): Temporal.ZonedDateTime {
    return date.toZonedDateTime(timeZone);
  }

  function result(value: Temporal.ZonedDateTime, temporality: EParseTemporality): IPipelineResult {
    return { value, temporality };
  }

  const isoSlots = tryParseISOSlots(trimmed, timeZone);
  if (!isNil(isoSlots)) {
    const isoZdt = assembleZDT(isoSlots, today, timeZone);
    if (!isNil(isoZdt)) {
      return result(isoZdt, EParseTemporality.ExplicitDate);
    }
  }

  const keywordResult = tryResolveKeywordWithTemporality(trimmed, today, timeZone);
  if (!isNil(keywordResult)) {
    return keywordResult;
  }

  const offsetMatch = OFFSET_REGEX.exec(trimmed);
  if (!isNil(offsetMatch)) {
    const direction = offsetMatch[1] === '+' ? 1 : -1;
    const offsetSlots = applyOffsetSlots(today, Number(offsetMatch[2]), offsetMatch[3], direction);
    const offsetDate = slotsToPlainDate(offsetSlots);
    if (!isNil(offsetDate)) {
      return result(
        toZDT(offsetDate),
        direction === 1 ? EParseTemporality.FutureDirected : EParseTemporality.PastDirected
      );
    }
  }

  const durationMatch = DURATION_FULL_REGEX.exec(trimmed);
  if (!isNil(durationMatch)) {
    const durationSlots = applyOffsetSlots(today, Number(durationMatch[1]), durationMatch[2], 1);
    const durationDate = slotsToPlainDate(durationSlots);
    if (!isNil(durationDate)) {
      return result(toZDT(durationDate), EParseTemporality.FutureDirected);
    }
  }

  const inMatch = IN_N_UNITS_REGEX.exec(trimmed);
  if (!isNil(inMatch)) {
    const inSlots = applyOffsetSlots(today, Number(inMatch[1]), inMatch[2][0], 1);
    const inDate = slotsToPlainDate(inSlots);
    if (!isNil(inDate)) {
      return result(toZDT(inDate), EParseTemporality.FutureDirected);
    }
  }

  const agoMatch = N_UNITS_AGO_REGEX.exec(trimmed);
  if (!isNil(agoMatch)) {
    const agoSlots = applyOffsetSlots(today, Number(agoMatch[1]), agoMatch[2][0], -1);
    const agoDate = slotsToPlainDate(agoSlots);
    if (!isNil(agoDate)) {
      return result(toZDT(agoDate), EParseTemporality.PastDirected);
    }
  }

  const nextLastMatch = NEXT_LAST_WEEKDAY_REGEX.exec(trimmed);
  if (!isNil(nextLastMatch)) {
    const direction = nextLastMatch[1].toLowerCase();
    const dayName = nextLastMatch[2].toLowerCase();
    const weekdaySlots =
      direction === 'next'
        ? resolveNextWeekdaySlots(dayName, today)
        : resolvePreviousWeekdaySlots(dayName, today);
    const weekdayDate = isNil(weekdaySlots) ? undefined : slotsToPlainDate(weekdaySlots);
    if (!isNil(weekdayDate)) {
      return result(
        toZDT(weekdayDate),
        direction === 'next' ? EParseTemporality.Weekday : EParseTemporality.PastDirected
      );
    }
  }

  const dayMonthYearMatch = DAY_MONTH_YEAR_REGEX.exec(trimmed);
  if (!isNil(dayMonthYearMatch)) {
    if (isAmbiguousHour(dayMonthYearMatch[3])) {
      const dmyDateSlots = resolvePartialDayMonthSlots(
        Number(dayMonthYearMatch[1]),
        dayMonthYearMatch[2],
        today
      );
      const dmyDate = isNil(dmyDateSlots) ? undefined : slotsToPlainDate(dmyDateSlots);
      if (!isNil(dmyDate)) {
        const hour = Number(dayMonthYearMatch[3]);
        const time = buildTimeSlots(hour, 0, 0, 0);
        if (!isNil(time)) {
          const zdt = applyTimeSlotsToZDT(toZDT(dmyDate), time);
          if (!isNil(zdt)) {
            return result(zdt, EParseTemporality.MonthDay);
          }
        }
      }
    } else {
      const dmySlots = tryBuildDateFromName(
        Number(dayMonthYearMatch[1]),
        dayMonthYearMatch[2],
        normalizeYear(dayMonthYearMatch[3])
      );
      const dmyNameDate = isNil(dmySlots) ? undefined : slotsToPlainDate(dmySlots);
      if (!isNil(dmyNameDate)) {
        return result(toZDT(dmyNameDate), EParseTemporality.ExplicitDate);
      }
    }
  }

  const monthDayYearMatch = MONTH_DAY_YEAR_REGEX.exec(trimmed);
  if (!isNil(monthDayYearMatch)) {
    if (isAmbiguousHour(monthDayYearMatch[3])) {
      const mdyDateSlots = resolvePartialDayMonthSlots(
        Number(monthDayYearMatch[2]),
        monthDayYearMatch[1],
        today
      );
      const mdyDate = isNil(mdyDateSlots) ? undefined : slotsToPlainDate(mdyDateSlots);
      if (!isNil(mdyDate)) {
        const hour = Number(monthDayYearMatch[3]);
        const time = buildTimeSlots(hour, 0, 0, 0);
        if (!isNil(time)) {
          const zdt = applyTimeSlotsToZDT(toZDT(mdyDate), time);
          if (!isNil(zdt)) {
            return result(zdt, EParseTemporality.MonthDay);
          }
        }
      }
    } else {
      const mdySlots = tryBuildDateFromName(
        Number(monthDayYearMatch[2]),
        monthDayYearMatch[1],
        normalizeYear(monthDayYearMatch[3])
      );
      const mdyNameDate = isNil(mdySlots) ? undefined : slotsToPlainDate(mdySlots);
      if (!isNil(mdyNameDate)) {
        return result(toZDT(mdyNameDate), EParseTemporality.ExplicitDate);
      }
    }
  }

  const numericSpaceMatch = NUMERIC_SPACE_DATE_REGEX.exec(trimmed);
  if (!isNil(numericSpaceMatch)) {
    const numSpaceSlots = tryBuildDateSlots(
      normalizeYear(numericSpaceMatch[3]),
      Number(numericSpaceMatch[2]),
      Number(numericSpaceMatch[1])
    );
    const numSpaceDate = isNil(numSpaceSlots) ? undefined : slotsToPlainDate(numSpaceSlots);
    if (!isNil(numSpaceDate)) {
      return result(toZDT(numSpaceDate), EParseTemporality.ExplicitDate);
    }
  }

  const quarterQMatch = QUARTER_Q_FULL_REGEX.exec(trimmed);
  if (!isNil(quarterQMatch)) {
    const quarter = Number(quarterQMatch[1]);
    const hasExplicitYear = !isNil(quarterQMatch[2]);
    const year = hasExplicitYear ? normalizeYear(quarterQMatch[2]) : today.year;
    const qSlots = resolveQuarterSlots(quarter, year);
    const qDate = isNil(qSlots) ? undefined : slotsToPlainDate(qSlots);
    if (!isNil(qDate)) {
      if (!hasExplicitYear && Temporal.PlainDate.compare(qDate, today) < 0) {
        const futureSlots = resolveQuarterSlots(quarter, today.year + 1);
        const futureDate = isNil(futureSlots) ? undefined : slotsToPlainDate(futureSlots);
        if (!isNil(futureDate)) {
          return result(
            toZDT(futureDate),
            hasExplicitYear ? EParseTemporality.ExplicitDate : EParseTemporality.Quarter
          );
        }
      }
      return result(
        toZDT(qDate),
        hasExplicitYear ? EParseTemporality.ExplicitDate : EParseTemporality.Quarter
      );
    }
  }

  const quarterNQMatch = QUARTER_NQ_FULL_REGEX.exec(trimmed);
  if (!isNil(quarterNQMatch)) {
    const quarter = Number(quarterNQMatch[1]);
    const year = normalizeYear(quarterNQMatch[2]);
    const nqSlots = resolveQuarterSlots(quarter, year);
    const nqDate = isNil(nqSlots) ? undefined : slotsToPlainDate(nqSlots);
    if (!isNil(nqDate)) {
      return result(toZDT(nqDate), EParseTemporality.ExplicitDate);
    }
  }

  const monthYearMatch = MONTH_YEAR_REGEX.exec(trimmed);
  if (!isNil(monthYearMatch)) {
    const yearStr = monthYearMatch[2] ?? monthYearMatch[3];
    const monthYearSlots = resolveMonthYearToSlots(monthYearMatch[1], normalizeYear(yearStr));
    if (!isNil(monthYearSlots)) {
      const monthYearZdt = assembleZDT(monthYearSlots, today, timeZone);
      if (!isNil(monthYearZdt)) {
        return result(monthYearZdt, EParseTemporality.ExplicitDate);
      }
    }
  }

  const yearMonthMatch = YEAR_MONTH_REGEX.exec(trimmed);
  if (!isNil(yearMonthMatch)) {
    const yearMonthSlots = resolveMonthYearToSlots(yearMonthMatch[2], Number(yearMonthMatch[1]));
    if (!isNil(yearMonthSlots)) {
      const yearMonthZdt = assembleZDT(yearMonthSlots, today, timeZone);
      if (!isNil(yearMonthZdt)) {
        return result(yearMonthZdt, EParseTemporality.ExplicitDate);
      }
    }
  }

  const isoMonthMatch = ISO_MONTH_REGEX.exec(trimmed);
  if (!isNil(isoMonthMatch)) {
    const isoMSlots = tryBuildDateSlots(Number(isoMonthMatch[1]), Number(isoMonthMatch[2]), 1);
    const isoMDate = isNil(isoMSlots) ? undefined : slotsToPlainDate(isoMSlots);
    if (!isNil(isoMDate)) {
      return result(toZDT(isoMDate), EParseTemporality.ExplicitDate);
    }
  }

  const slashMonthMatch = SLASH_MONTH_REGEX.exec(trimmed);
  if (!isNil(slashMonthMatch)) {
    const slashMSlots = tryBuildDateSlots(
      Number(slashMonthMatch[2]),
      Number(slashMonthMatch[1]),
      1
    );
    const slashMDate = isNil(slashMSlots) ? undefined : slotsToPlainDate(slashMSlots);
    if (!isNil(slashMDate)) {
      return result(toZDT(slashMDate), EParseTemporality.ExplicitDate);
    }
  }

  const weekdayNameSlots = resolveNextWeekdaySlots(trimmed, today);
  const weekdayNameDate = isNil(weekdayNameSlots) ? undefined : slotsToPlainDate(weekdayNameSlots);
  if (!isNil(weekdayNameDate)) {
    return result(toZDT(weekdayNameDate), EParseTemporality.Weekday);
  }

  const dayMonthMatch = DAY_MONTH_REGEX.exec(trimmed);
  if (!isNil(dayMonthMatch)) {
    const dmSlots = resolvePartialDayMonthSlots(Number(dayMonthMatch[1]), dayMonthMatch[2], today);
    const dmDate = isNil(dmSlots) ? undefined : slotsToPlainDate(dmSlots);
    if (!isNil(dmDate)) {
      return result(toZDT(dmDate), EParseTemporality.MonthDay);
    }
  }

  const monthDayMatch = MONTH_DAY_REGEX.exec(trimmed);
  if (!isNil(monthDayMatch)) {
    const mdSlots = resolvePartialDayMonthSlots(Number(monthDayMatch[2]), monthDayMatch[1], today);
    const mdDate = isNil(mdSlots) ? undefined : slotsToPlainDate(mdSlots);
    if (!isNil(mdDate)) {
      return result(toZDT(mdDate), EParseTemporality.MonthDay);
    }
  }

  const ordinalMatch = ORDINAL_DAY_REGEX.exec(trimmed);
  if (!isNil(ordinalMatch)) {
    const ordSlots = resolveOrdinalDaySlots(Number(ordinalMatch[1]), today);
    const ordDate = isNil(ordSlots) ? undefined : slotsToPlainDate(ordSlots);
    if (!isNil(ordDate)) {
      return result(toZDT(ordDate), EParseTemporality.DayOfMonth);
    }
  }

  const directDateSlots = tryParseDirectDateSlots(trimmed);
  if (!isNil(directDateSlots)) {
    const directZdt = assembleZDT(directDateSlots, today, timeZone);
    if (!isNil(directZdt)) {
      return result(directZdt, EParseTemporality.ExplicitDate);
    }
  }

  const monthOnlyMatch = MONTH_NAME_REGEX.exec(trimmed);
  if (!isNil(monthOnlyMatch)) {
    const monthOnlySlots = resolveMonthNameToSlots(monthOnlyMatch[1], today);
    if (!isNil(monthOnlySlots)) {
      const monthOnlyZdt = assembleZDT(monthOnlySlots, today, timeZone);
      if (!isNil(monthOnlyZdt)) {
        return result(monthOnlyZdt, EParseTemporality.MonthOnly);
      }
    }
  }

  return undefined;
}

function tryParseDateWithTimeSuffix(
  input: string,
  today: Temporal.PlainDate,
  timeZone: string
): IPipelineResult | undefined {
  const split = splitTimeSuffixSlots(input);
  if (isNil(split)) {
    return undefined;
  }

  const dateResult = tryParseDateOnly(split.datePart, today, timeZone);
  if (isNil(dateResult)) {
    return undefined;
  }

  const value = applyTimeSlotsToZDT(dateResult.value, split.timeSlots);
  if (isNil(value)) {
    return undefined;
  }

  return { value, temporality: dateResult.temporality };
}

function tryParseDateWithBareTimeSuffix(
  input: string,
  today: Temporal.PlainDate,
  timeZone: string
): IPipelineResult | undefined {
  const split = splitBareTimeSuffixSlots(input);
  if (isNil(split)) {
    return undefined;
  }

  const dateResult = tryParseDateOnly(split.datePart, today, timeZone);
  if (isNil(dateResult)) {
    return undefined;
  }

  const value = applyTimeSlotsToZDT(dateResult.value, split.timeSlots);
  if (isNil(value)) {
    return undefined;
  }

  return { value, temporality: dateResult.temporality };
}

function tryParseTokenPipeline(
  input: string,
  today: Temporal.PlainDate,
  timeZone: string
): Temporal.ZonedDateTime | undefined {
  const tokens = tokenize(input);

  if (tokens.some(t => t.kind === ETokenKind.Unknown)) {
    return undefined;
  }

  if (tokens.length === 0 || tokens.length > MAX_TOKEN_COUNT) {
    return undefined;
  }

  const conflict = detectConflicts(tokens);
  if (!isNil(conflict)) {
    return undefined;
  }

  const context = buildSlotContext(tokens);

  let baseDate: Temporal.PlainDate | undefined;
  let baseTime: Temporal.PlainTime | undefined;
  let knownMonth: number | undefined;
  let knownDay: number | undefined;
  let knownYear: number | undefined;
  let amPmValue: number | undefined;

  for (const token of tokens) {
    switch (token.kind) {
      case ETokenKind.Keyword: {
        const kwSlots = resolveKeywordToDateSlots(token, today);
        if (!isNil(kwSlots)) {
          const kwDate = slotsToPlainDate(kwSlots);
          if (!isNil(kwDate)) {
            baseDate = kwDate;
          }
          const kwTime = slotsToPlainTime(kwSlots);
          if (!isNil(kwTime)) {
            baseTime = kwTime;
          }
        }
        break;
      }
      case ETokenKind.TimeKeyword: {
        const tkSlots = resolveTimeKeywordToSlots(token.raw.toLowerCase());
        if (!isNil(tkSlots)) {
          const tkTime = slotsToPlainTime(tkSlots);
          if (!isNil(tkTime)) {
            baseTime = tkTime;
          }
        }
        break;
      }
      case ETokenKind.BoundaryKeyword: {
        const bkSlots = resolveBoundaryKeywordToSlots(token.raw.toLowerCase(), today);
        if (!isNil(bkSlots)) {
          const bkDate = slotsToPlainDate(bkSlots);
          if (!isNil(bkDate)) {
            baseDate = bkDate;
          }
        }
        break;
      }
      case ETokenKind.MonthName:
        knownMonth = token.value;
        break;
      case ETokenKind.ColonTime: {
        const parts = token.extra?.split(/[:.]/);
        if (!isNil(parts) && parts.length >= COLON_TIME_PARTS_MIN) {
          const ctSlots = buildTimeSlots(
            Number(parts[0]),
            Number(parts[1]),
            parts.length > 2 ? Number(parts[2]) : 0,
            parts.length > COLON_TIME_PARTS_WITH_MS ? Number(parts[COLON_TIME_PARTS_WITH_MS]) : 0
          );
          if (!isNil(ctSlots)) {
            const ctTime = slotsToPlainTime(ctSlots);
            if (!isNil(ctTime)) {
              baseTime = ctTime;
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
        const oUnit = token.extra ?? 'd';
        const oDir = token.value >= 0 ? 1 : -1;
        const oSlots = applyOffsetSlots(today, Math.abs(token.value), oUnit, oDir);
        const oDate = slotsToPlainDate(oSlots);
        if (!isNil(oDate)) {
          baseDate = oDate;
        }
        break;
      }
      case ETokenKind.Duration: {
        const dUnit = token.extra ?? 'd';
        const dSlots = applyOffsetSlots(today, token.value, dUnit, 1);
        const dDate = slotsToPlainDate(dSlots);
        if (!isNil(dDate)) {
          baseDate = dDate;
        }
        break;
      }
      case ETokenKind.WeekdayName: {
        const wdSlots = resolveNextWeekdaySlots(token.raw.toLowerCase(), today);
        const wdDate = isNil(wdSlots) ? undefined : slotsToPlainDate(wdSlots);
        if (!isNil(wdDate)) {
          baseDate = wdDate;
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
      const btSlots = buildTimeSlots(hour, minute, second, ms);
      baseTime = isNil(btSlots) ? undefined : slotsToPlainTime(btSlots);
    }
  }

  let resultDate: Temporal.PlainDate | undefined = baseDate;

  if (isNil(resultDate)) {
    if (!isNil(knownMonth) && !isNil(knownDay)) {
      if (!isNil(knownYear)) {
        const rdSlots = tryBuildDateSlots(knownYear, knownMonth, knownDay);
        resultDate = isNil(rdSlots) ? undefined : slotsToPlainDate(rdSlots);
      } else {
        const pdSlots = resolvePartialDayMonthNumericSlots(knownDay, knownMonth, today);
        resultDate = isNil(pdSlots) ? undefined : slotsToPlainDate(pdSlots);
      }
    } else if (!isNil(knownDay) && isNil(knownMonth)) {
      const odSlots = resolveOrdinalDaySlots(knownDay, today);
      resultDate = isNil(odSlots) ? undefined : slotsToPlainDate(odSlots);
    } else if (!isNil(baseTime) && isNil(knownMonth) && isNil(knownDay)) {
      resultDate = today;
    }
  }

  if (isNil(resultDate)) {
    return undefined;
  }

  if (!isNil(baseTime)) {
    return resultDate.toZonedDateTime({ timeZone, plainTime: baseTime });
  }

  return resultDate.toZonedDateTime(timeZone);
}

function tryParseUniversalNumericSlots(input: string): ISlotMap | undefined {
  const parts = input.split(/\D+/).filter(s => s.length > 0);

  if (parts.length < MIN_UNIVERSAL_PARTS || parts.length > MAX_UNIVERSAL_PARTS) {
    return undefined;
  }

  const day = Number(parts[UNIVERSAL_DAY_INDEX]);
  const month = Number(parts[UNIVERSAL_MONTH_INDEX]);
  const year = normalizeYear(parts[UNIVERSAL_YEAR_INDEX]);

  const dateSlots = tryBuildDateSlots(year, month, day);

  if (isNil(dateSlots)) {
    return undefined;
  }

  if (parts.length === MIN_UNIVERSAL_PARTS) {
    return dateSlots;
  }

  const hour = Number(parts[UNIVERSAL_HOUR_INDEX]);
  const minute = parts.length > UNIVERSAL_MINUTE_INDEX ? Number(parts[UNIVERSAL_MINUTE_INDEX]) : 0;
  const second = parts.length > UNIVERSAL_SECOND_INDEX ? Number(parts[UNIVERSAL_SECOND_INDEX]) : 0;
  const ms =
    parts.length > UNIVERSAL_MS_INDEX ? normalizeMilliseconds(parts[UNIVERSAL_MS_INDEX]) : 0;

  const timeSlots = buildTimeSlots(hour, minute, second, ms);

  if (isNil(timeSlots)) {
    return undefined;
  }

  return mergeSlots(dateSlots, timeSlots);
}

function splitTimeSuffixSlots(
  input: string
): { datePart: string; timeSlots: ISlotMap } | undefined {
  const timeMatch = TIME_SUFFIX_REGEX.exec(input);
  if (!isNil(timeMatch)) {
    const timeSlots = buildTimeSlots(
      Number(timeMatch[1]),
      Number(timeMatch[2]),
      isNil(timeMatch[3]) ? 0 : Number(timeMatch[3]),
      isNil(timeMatch[4]) ? 0 : normalizeMilliseconds(timeMatch[4])
    );
    if (!isNil(timeSlots)) {
      return { datePart: input.slice(0, timeMatch.index).trim(), timeSlots };
    }
  }

  const ampmMatch = AMPM_SUFFIX_REGEX.exec(input);
  if (!isNil(ampmMatch)) {
    const hour = convertAmPmHour(Number(ampmMatch[1]), ampmMatch[4]);
    if (!isNil(hour)) {
      const timeSlots = buildTimeSlots(
        hour,
        isNil(ampmMatch[2]) ? 0 : Number(ampmMatch[2]),
        isNil(ampmMatch[3]) ? 0 : Number(ampmMatch[3]),
        0
      );
      if (!isNil(timeSlots)) {
        return { datePart: input.slice(0, ampmMatch.index).trim(), timeSlots };
      }
    }
  }

  return undefined;
}

function splitBareTimeSuffixSlots(
  input: string
): { datePart: string; timeSlots: ISlotMap } | undefined {
  const match = BARE_TIME_SUFFIX_REGEX.exec(input);

  if (isNil(match)) {
    return undefined;
  }

  const datePart = input.slice(0, match.index).trim();

  if (datePart.length === 0) {
    return undefined;
  }

  const hour = Number(match[1]);
  const minute = isNil(match[2]) ? 0 : Number(match[2]);
  const second = isNil(match[3]) ? 0 : Number(match[3]);
  const millisecond = isNil(match[4]) ? 0 : normalizeMilliseconds(match[4]);

  const timeSlots = buildTimeSlots(hour, minute, second, millisecond);

  if (isNil(timeSlots)) {
    return undefined;
  }

  return { datePart, timeSlots };
}
