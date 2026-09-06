import { isNil } from 'lodash-es';

import { isDigit, isLetter } from './fsm-scan';
import {
  BOUNDARY_KEYWORD_SET,
  DATE_KEYWORD_SET,
  MONTH_MAP,
  MULTI_WORD_BOUNDARY_MAP,
  TIME_KEYWORD_SET,
  UNIT_MAP,
  WEEKDAY_MAP,
} from './lookups';
import {
  COLON_TIME_VALUE_HOUR_MULTIPLIER,
  isAllDigits,
  tryParseColonTime,
  tryParseNumberWithAmPm,
  tryParseOffset,
  tryParseDuration,
  tryParseOrdinal,
  tryParseQuarter,
  tryParseApostropheYear,
  tryParseAmPm,
} from './token-parsers';
import type { IToken } from './types';
import { ETokenKind } from './types';

/** Turning one raw part into tokens: the specific shapes first, then keywords, numbers and month names. */
export function classifySingleToken(raw: string): IToken[] {
  const lower = raw.toLowerCase();

  // Check for hyphenated boundary keywords (e.g., "end-of-month")
  const boundaryAlias = MULTI_WORD_BOUNDARY_MAP.get(lower);
  if (!isNil(boundaryAlias)) {
    return [
      {
        kind: ETokenKind.BoundaryKeyword,
        raw,
        value: 0,
      },
    ];
  }

  if (BOUNDARY_KEYWORD_SET.has(lower)) {
    return [{ kind: ETokenKind.BoundaryKeyword, raw, value: 0 }];
  }

  // Colon time (with or without am/pm): "5:30pm", "13:00", "9:30:45.123"
  const colonTimeResult = tryParseColonTime(raw);
  if (!isNil(colonTimeResult)) {
    return colonTimeResult;
  }

  // Number with am/pm suffix: "9am", "5pm"
  const numAmPmResult = tryParseNumberWithAmPm(raw);
  if (!isNil(numAmPmResult)) {
    return numAmPmResult;
  }

  // Offset: "+3d", "-1w"
  const offsetResult = tryParseOffset(raw);
  if (!isNil(offsetResult)) {
    return offsetResult;
  }

  // Duration: "3d", "1w"
  const durationResult = tryParseDuration(raw);
  if (!isNil(durationResult)) {
    return durationResult;
  }

  if (DATE_KEYWORD_SET.has(lower)) {
    return [{ kind: ETokenKind.Keyword, raw, value: 0 }];
  }

  if (TIME_KEYWORD_SET.has(lower)) {
    return [{ kind: ETokenKind.TimeKeyword, raw, value: 0 }];
  }

  const monthNum = MONTH_MAP.get(lower);
  if (!isNil(monthNum)) {
    return [{ kind: ETokenKind.MonthName, raw, value: monthNum }];
  }

  const weekdayNum = WEEKDAY_MAP.get(lower);
  if (!isNil(weekdayNum)) {
    return [{ kind: ETokenKind.WeekdayName, raw, value: weekdayNum }];
  }

  if (lower === 'next' || lower === 'last') {
    return [
      {
        kind: ETokenKind.Direction,
        raw,
        value: lower === 'next' ? 1 : -1,
      },
    ];
  }

  const unitChar = UNIT_MAP.get(lower);
  if (!isNil(unitChar)) {
    return [{ kind: ETokenKind.Unit, raw, value: 0, extra: unitChar }];
  }

  // Standalone am/pm
  const amPmResult = tryParseAmPm(raw);
  if (!isNil(amPmResult)) {
    return amPmResult;
  }

  // Quarter: "Q1", "1Q", "1Q25", "4q2025"
  const quarterResult = tryParseQuarter(raw);
  if (!isNil(quarterResult)) {
    return quarterResult;
  }

  // Ordinal: "15th", "1st", "2nd", "3rd"
  const ordinalResult = tryParseOrdinal(raw);
  if (!isNil(ordinalResult)) {
    return ordinalResult;
  }

  // Apostrophe year: "'27"
  const apostropheResult = tryParseApostropheYear(raw);
  if (!isNil(apostropheResult)) {
    return apostropheResult;
  }

  // Pure number
  if (isAllDigits(raw)) {
    return [{ kind: ETokenKind.Number, raw, value: Number(raw) }];
  }

  // Letters-only keyword + trailing digits as hour: "yesterday10", "mon14", "tom9"
  const keywordHourResult = tryParseKeywordWithHour(raw);
  if (!isNil(keywordHourResult)) {
    return keywordHourResult;
  }

  // Try to detect mixed tokens: number+monthname, monthname+number
  const numMonthResult = tryClassifyMixedNumMonth(raw);
  if (!isNil(numMonthResult)) {
    return numMonthResult;
  }

  return [{ kind: ETokenKind.Unknown, raw, value: 0 }];
}

function tryClassifyMixedNumMonth(raw: string): IToken[] | undefined {
  const lower = raw.toLowerCase();

  // Try: number prefix + month name (e.g., "10nov", "15nov2025")
  for (const [name, monthNum] of MONTH_MAP) {
    const nameIndex = lower.indexOf(name);
    if (nameIndex < 0) {
      continue;
    }

    const prefix = lower.slice(0, nameIndex);
    const suffix = lower.slice(nameIndex + name.length);

    if (prefix.length > 0 && isAllDigits(prefix)) {
      // If suffix contains non-digit characters, skip this match and try
      // a longer month name (e.g., "mar" -> "march" in "10march2025")
      if (suffix.length > 0 && !isAllDigits(suffix)) {
        continue;
      }
      const result: IToken[] = [
        { kind: ETokenKind.Number, raw: prefix, value: Number(prefix) },
        { kind: ETokenKind.MonthName, raw: name, value: monthNum },
      ];
      if (suffix.length > 0) {
        result.push({
          kind: ETokenKind.Number,
          raw: suffix,
          value: Number(suffix),
        });
      }
      return result;
    }

    // month name prefix + number (e.g., "nov10", "January20")
    if (nameIndex === 0 && suffix.length > 0 && isAllDigits(suffix)) {
      return [
        { kind: ETokenKind.MonthName, raw: name, value: monthNum },
        { kind: ETokenKind.Number, raw: suffix, value: Number(suffix) },
      ];
    }
  }

  return undefined;
}

const MAX_KEYWORD_HOUR = 23;

/**
 * Parse a letters-only date keyword or weekday name followed by trailing digits
 * as hour. E.g., "yesterday10" → [Keyword("yesterday"), ColonTime(10:00)],
 * "mon14" → [WeekdayName("mon"), ColonTime(14:00)].
 *
 * Only applies to tokens that are purely alphabetic (no spaces, digits, or
 * special characters in the keyword part) and that fully determine a day
 * (date keywords like "today"/"tomorrow"/"yesterday" and weekday names).
 */
function tryParseKeywordWithHour(raw: string): IToken[] | undefined {
  const lower = raw.toLowerCase();

  // Find where digits start
  let splitIndex = -1;
  for (let index = 0; index < lower.length; index++) {
    if (isDigit(lower[index])) {
      splitIndex = index;
      break;
    }
  }

  if (splitIndex <= 0) {
    return undefined;
  }

  const wordPart = lower.slice(0, splitIndex);
  const digitPart = lower.slice(splitIndex);

  // Word part must be all letters
  for (let index = 0; index < wordPart.length; index++) {
    if (!isLetter(wordPart[index])) {
      return undefined;
    }
  }

  // Digit part must be all digits
  if (!isAllDigits(digitPart)) {
    return undefined;
  }

  const hour = Number(digitPart);
  if (hour > MAX_KEYWORD_HOUR) {
    return undefined;
  }

  const hourToken: IToken = {
    kind: ETokenKind.ColonTime,
    raw: digitPart,
    value: hour * COLON_TIME_VALUE_HOUR_MULTIPLIER,
    extra: `${hour}:0:0.0`,
  };

  // Check date keywords: today, tomorrow, tom, yesterday, now
  if (DATE_KEYWORD_SET.has(wordPart)) {
    return [{ kind: ETokenKind.Keyword, raw: wordPart, value: 0 }, hourToken];
  }

  // Check weekday names: mon, tue, wednesday, etc.
  const weekdayNum = WEEKDAY_MAP.get(wordPart);
  if (!isNil(weekdayNum)) {
    return [{ kind: ETokenKind.WeekdayName, raw: wordPart, value: weekdayNum }, hourToken];
  }

  return undefined;
}
