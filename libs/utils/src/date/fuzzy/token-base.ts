import { isNil } from 'lodash-es';
import type { Temporal } from 'temporal-polyfill';
import { COLON_TIME_PARTS_MIN, COLON_TIME_PARTS_WITH_MS } from './constants';
import {
  applyOffsetSlots,
  resolveBoundaryKeywordToSlots,
  resolveKeywordToDateSlots,
  resolveNextWeekdaySlots,
  resolveQuarterFromToken,
  resolveTimeKeywordToSlots,
} from './resolvers';
import { buildTimeSlots, slotsToPlainDate, slotsToPlainTime } from './slots';
import type { IToken } from './types';
import { ETokenKind } from './types';

/** What the tokens state outright, before the ambiguous numbers are scored into slots. */
export interface TokenBase {
  readonly baseDate: Temporal.PlainDate | undefined;
  readonly baseTime: Temporal.PlainTime | undefined;
  readonly knownMonth: number | undefined;
  readonly knownDay: number | undefined;
  readonly amPmValue: number | undefined;
}

/** Walks the tokens once: keywords, offsets and weekdays settle a date, colon times and time keywords a time. */
export function collectTokenBase(tokens: IToken[], today: Temporal.PlainDate): TokenBase {
  let baseDate: Temporal.PlainDate | undefined;
  let baseTime: Temporal.PlainTime | undefined;
  let knownMonth: number | undefined;
  let knownDay: number | undefined;
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

  return { baseDate, baseTime, knownMonth, knownDay, amPmValue };
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
