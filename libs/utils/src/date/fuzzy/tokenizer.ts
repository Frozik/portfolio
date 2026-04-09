import { isNil } from 'lodash-es';

import { NOON_HOUR } from './constants';
import {
  BOUNDARY_KEYWORD_SET,
  DATE_KEYWORD_SET,
  MONTH_MAP,
  MULTI_WORD_BOUNDARY_MAP,
  TIME_KEYWORD_SET,
  UNIT_MAP,
  WEEKDAY_MAP,
} from './lookups';
import { convertAmPmHour, normalizeMilliseconds, normalizeYear } from './slots';
import type { IToken } from './types';
import { ESeparatorKind, ETokenKind } from './types';

enum EFsmState {
  Initial = 'Initial',
  ReadingDigits = 'ReadingDigits',
  ReadingWord = 'ReadingWord',
  ReadingMixed = 'ReadingMixed',
}

const SEPARATOR_SET = new Set<string>([
  ESeparatorKind.Colon,
  ESeparatorKind.Dash,
  ESeparatorKind.Slash,
  ESeparatorKind.Dot,
]);

function isDigit(char: string): boolean {
  return char >= '0' && char <= '9';
}

function isLetter(char: string): boolean {
  return (char >= 'a' && char <= 'z') || (char >= 'A' && char <= 'Z');
}

function isWhitespace(char: string): boolean {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r';
}

function isSeparator(char: string): boolean {
  return SEPARATOR_SET.has(char);
}

/**
 * FSM-based tokenizer that scans input character by character.
 * Produces raw token strings and separator tokens, then classifies them.
 */
export function fsmScan(input: string): string[] {
  const rawParts: string[] = [];
  let state = EFsmState.Initial;
  let buffer = '';

  function emit(): void {
    if (buffer.length > 0) {
      rawParts.push(buffer);
      buffer = '';
    }
    state = EFsmState.Initial;
  }

  for (let index = 0; index < input.length; index++) {
    const char = input[index];

    if (char === ',') {
      emit();
      continue;
    }

    switch (state) {
      case EFsmState.Initial: {
        if (isWhitespace(char)) {
          continue;
        }
        if (char === "'") {
          buffer = char;
          state = EFsmState.ReadingMixed;
          continue;
        }
        if (isDigit(char)) {
          buffer = char;
          state = EFsmState.ReadingDigits;
          continue;
        }
        if (char === '+' || char === '-') {
          buffer = char;
          state = EFsmState.ReadingMixed;
          continue;
        }
        if (isLetter(char)) {
          buffer = char;
          state = EFsmState.ReadingWord;
          continue;
        }
        if (isSeparator(char)) {
          rawParts.push(char);
          continue;
        }
        buffer = char;
        state = EFsmState.ReadingMixed;
        continue;
      }

      case EFsmState.ReadingDigits: {
        if (isDigit(char)) {
          buffer += char;
          continue;
        }
        if (isLetter(char)) {
          buffer += char;
          state = EFsmState.ReadingMixed;
          continue;
        }
        if (isSeparator(char)) {
          emit();
          rawParts.push(char);
          continue;
        }
        if (isWhitespace(char)) {
          emit();
          continue;
        }
        buffer += char;
        state = EFsmState.ReadingMixed;
        continue;
      }

      case EFsmState.ReadingWord: {
        if (isLetter(char) || char === '-') {
          buffer += char;
          continue;
        }
        if (isDigit(char)) {
          buffer += char;
          state = EFsmState.ReadingMixed;
          continue;
        }
        if (isWhitespace(char)) {
          emit();
          continue;
        }
        if (isSeparator(char)) {
          emit();
          rawParts.push(char);
          continue;
        }
        if (char === "'") {
          buffer += char;
          state = EFsmState.ReadingMixed;
          continue;
        }
        emit();
        buffer = char;
        state = EFsmState.ReadingMixed;
        continue;
      }

      case EFsmState.ReadingMixed: {
        if (isDigit(char) || isLetter(char)) {
          buffer += char;
          continue;
        }
        if (isWhitespace(char)) {
          emit();
          continue;
        }
        if (isSeparator(char)) {
          emit();
          rawParts.push(char);
          continue;
        }
        buffer += char;
        continue;
      }
    }
  }

  emit();
  return rawParts;
}

/**
 * Tokenize input using FSM scanner, then classify each raw part.
 * Separators between raw parts are reconstituted into compound strings
 * before classification, preserving backward compatibility.
 */
export function tokenize(input: string): IToken[] {
  const rawParts = fsmScan(input);
  const mergedParts = mergeRawPartsWithSeparators(rawParts);
  const tokens: IToken[] = [];

  for (const raw of mergedParts) {
    const classified = classifySingleToken(raw);
    tokens.push(...classified);
  }

  return mergeMultiWordTokens(tokens);
}

/**
 * Merge raw parts that are connected by separators back into compound strings.
 * E.g., ["13", ":", "00"] → ["13:00"]
 * E.g., ["5", ":", "30pm"] → ["5:30pm"]
 * This preserves the original tokenizer's behavior of treating
 * colon-time and similar patterns as single tokens.
 */
function mergeRawPartsWithSeparators(parts: string[]): string[] {
  const result: string[] = [];
  let index = 0;

  while (index < parts.length) {
    if (
      index + 2 < parts.length &&
      SEPARATOR_SET.has(parts[index + 1]) &&
      !isWhitespaceOnly(parts[index]) &&
      !isWhitespaceOnly(parts[index + 2])
    ) {
      // Accumulate connected non-whitespace tokens through separators
      let compound = parts[index] + parts[index + 1] + parts[index + 2];
      index += 3;
      while (
        index + 1 < parts.length &&
        SEPARATOR_SET.has(parts[index]) &&
        !isWhitespaceOnly(parts[index + 1])
      ) {
        compound += parts[index] + parts[index + 1];
        index += 2;
      }
      result.push(compound);
    } else if (SEPARATOR_SET.has(parts[index])) {
      // Standalone separator (not between tokens) — skip
      index++;
    } else {
      result.push(parts[index]);
      index++;
    }
  }

  return result;
}

function isWhitespaceOnly(value: string): boolean {
  return value.trim().length === 0;
}

/**
 * FSM tokenize: produces tokens including Separator tokens.
 * Used by the unified pipeline for separator-aware parsing.
 */
export function fsmTokenize(input: string): IToken[] {
  const rawParts = fsmScan(input);
  const tokens: IToken[] = [];

  for (const raw of rawParts) {
    if (SEPARATOR_SET.has(raw)) {
      tokens.push({
        kind: ETokenKind.Separator,
        raw,
        value: 0,
      });
      continue;
    }
    const classified = classifySingleToken(raw);
    tokens.push(...classified);
  }

  return mergeMultiWordTokens(tokens);
}

export function mergeMultiWordTokens(tokens: IToken[]): IToken[] {
  const result: IToken[] = [];
  let index = 0;

  while (index < tokens.length) {
    if (
      tokens[index].raw.toLowerCase() === 'the' &&
      tokens[index].kind === ETokenKind.Unknown &&
      index + 1 < tokens.length &&
      tokens[index + 1].kind === ETokenKind.Ordinal
    ) {
      result.push(tokens[index + 1]);
      index += 2;
      continue;
    }

    if (index + 2 < tokens.length) {
      const threeWordKey =
        `${tokens[index].raw.toLowerCase()} ` +
        `${tokens[index + 1].raw.toLowerCase()} ` +
        `${tokens[index + 2].raw.toLowerCase()}`;
      const boundaryAlias = MULTI_WORD_BOUNDARY_MAP.get(threeWordKey);
      if (!isNil(boundaryAlias)) {
        result.push({
          kind: ETokenKind.BoundaryKeyword,
          raw: threeWordKey,
          value: 0,
        });
        index += 3;
        continue;
      }
    }

    if (
      tokens[index].raw.toLowerCase() === 'in' &&
      tokens[index].kind === ETokenKind.Unknown &&
      index + 2 < tokens.length &&
      tokens[index + 1].kind === ETokenKind.Number &&
      tokens[index + 2].kind === ETokenKind.Unit
    ) {
      result.push({
        kind: ETokenKind.Offset,
        raw: `${tokens[index].raw} ${tokens[index + 1].raw} ${tokens[index + 2].raw}`,
        value: tokens[index + 1].value,
        extra: tokens[index + 2].extra,
      });
      index += 3;
      continue;
    }

    if (
      tokens[index].kind === ETokenKind.Number &&
      index + 2 < tokens.length &&
      tokens[index + 1].kind === ETokenKind.Unit &&
      tokens[index + 2].raw.toLowerCase() === 'ago' &&
      tokens[index + 2].kind === ETokenKind.Unknown
    ) {
      result.push({
        kind: ETokenKind.Offset,
        raw: `${tokens[index].raw} ${tokens[index + 1].raw} ${tokens[index + 2].raw}`,
        value: -tokens[index].value,
        extra: tokens[index + 1].extra,
      });
      index += 3;
      continue;
    }

    if (
      tokens[index].kind === ETokenKind.Direction &&
      index + 1 < tokens.length &&
      tokens[index + 1].kind === ETokenKind.WeekdayName
    ) {
      result.push({
        kind: ETokenKind.Keyword,
        raw: `${tokens[index].raw} ${tokens[index + 1].raw}`,
        value: tokens[index].value,
        extra: `weekday:${tokens[index + 1].raw.toLowerCase()}`,
      });
      index += 2;
      continue;
    }

    result.push(tokens[index]);
    index++;
  }

  return result;
}

const COLON_TIME_VALUE_HOUR_MULTIPLIER = 10000;
const COLON_TIME_VALUE_MINUTE_MULTIPLIER = 100;
const MAX_ORDINAL_DAY = 31;
const MIN_QUARTER = 1;
const MAX_QUARTER = 4;
const ORDINAL_SUFFIXES = new Set(['st', 'nd', 'rd', 'th']);
const DURATION_UNIT_CHARS = new Set(['d', 'w', 'm', 'y']);

function isAllDigits(value: string): boolean {
  if (value.length === 0) {
    return false;
  }
  for (let index = 0; index < value.length; index++) {
    if (!isDigit(value[index])) {
      return false;
    }
  }
  return true;
}

function tryParseColonTime(raw: string): IToken[] | undefined {
  const colonIndex = raw.indexOf(':');
  if (colonIndex < 0) {
    return undefined;
  }

  // Extract trailing am/pm suffix if present
  const lower = raw.toLowerCase();
  let body = raw;
  let ampmSuffix: string | undefined;
  if (lower.endsWith('am') || lower.endsWith('pm')) {
    ampmSuffix = lower.slice(-2);
    body = raw.slice(0, -2);
  }

  // Split on ':' and '.'
  const colonParts = body.split(':');
  if (colonParts.length < 2 || colonParts.length > 3) {
    return undefined;
  }

  const hourStr = colonParts[0];
  const minuteStr = colonParts[1];
  let secondStr = '0';
  let msStr = '0';

  if (colonParts.length === 3) {
    const dotIndex = colonParts[2].indexOf('.');
    if (dotIndex >= 0) {
      secondStr = colonParts[2].slice(0, dotIndex);
      msStr = colonParts[2].slice(dotIndex + 1);
    } else {
      secondStr = colonParts[2];
    }
  } else if (colonParts.length === 2) {
    // Check if minute part has dot for fractional seconds: "HH:MM" (no dot expected here)
    // Actually dots in HH:MM part aren't typical, but the last part may have dots
    const dotIndex = minuteStr.indexOf('.');
    if (dotIndex >= 0) {
      return undefined;
    }
  }

  if (!isAllDigits(hourStr) || hourStr.length === 0) {
    return undefined;
  }
  if (!isAllDigits(minuteStr) || minuteStr.length === 0) {
    return undefined;
  }
  if (secondStr.length > 0 && !isAllDigits(secondStr)) {
    return undefined;
  }
  if (msStr.length > 0 && !isAllDigits(msStr)) {
    return undefined;
  }

  let hour = Number(hourStr);
  const minute = Number(minuteStr);
  const second = secondStr.length === 0 ? 0 : Number(secondStr);
  const ms = msStr === '0' || msStr.length === 0 ? 0 : normalizeMilliseconds(msStr);

  if (!isNil(ampmSuffix)) {
    const converted = convertAmPmHour(hour, ampmSuffix);
    if (isNil(converted)) {
      return undefined;
    }
    hour = converted;
  }

  return [
    {
      kind: ETokenKind.ColonTime,
      raw,
      value:
        hour * COLON_TIME_VALUE_HOUR_MULTIPLIER +
        minute * COLON_TIME_VALUE_MINUTE_MULTIPLIER +
        second,
      extra: `${hour}:${minute}:${second}.${ms}`,
    },
  ];
}

function tryParseNumberWithAmPm(raw: string): IToken[] | undefined {
  const lower = raw.toLowerCase();
  if (lower.length < 3) {
    return undefined;
  }

  if (!lower.endsWith('am') && !lower.endsWith('pm')) {
    return undefined;
  }

  const numPart = raw.slice(0, -2);
  if (!isAllDigits(numPart) || numPart.length === 0 || numPart.length > 2) {
    return undefined;
  }

  const baseHour = Number(numPart);
  const ampmSuffix = lower.slice(-2);
  const hour = convertAmPmHour(baseHour, ampmSuffix);

  if (isNil(hour)) {
    return undefined;
  }

  return [
    {
      kind: ETokenKind.ColonTime,
      raw,
      value: hour * COLON_TIME_VALUE_HOUR_MULTIPLIER,
      extra: `${hour}:0:0.0`,
    },
  ];
}

function tryParseOffset(raw: string): IToken[] | undefined {
  if (raw.length < 3) {
    return undefined;
  }

  const firstChar = raw[0];
  if (firstChar !== '+' && firstChar !== '-') {
    return undefined;
  }

  const lastChar = raw[raw.length - 1].toLowerCase();
  if (!DURATION_UNIT_CHARS.has(lastChar)) {
    return undefined;
  }

  const digits = raw.slice(1, -1);
  if (!isAllDigits(digits) || digits.length === 0) {
    return undefined;
  }

  const direction = firstChar === '+' ? 1 : -1;
  return [
    {
      kind: ETokenKind.Offset,
      raw,
      value: Number(digits) * direction,
      extra: lastChar,
    },
  ];
}

function tryParseDuration(raw: string): IToken[] | undefined {
  if (raw.length < 2) {
    return undefined;
  }

  const lastChar = raw[raw.length - 1].toLowerCase();
  if (!DURATION_UNIT_CHARS.has(lastChar)) {
    return undefined;
  }

  const digits = raw.slice(0, -1);
  if (!isAllDigits(digits) || digits.length === 0) {
    return undefined;
  }

  return [
    {
      kind: ETokenKind.Duration,
      raw,
      value: Number(digits),
      extra: lastChar,
    },
  ];
}

function tryParseOrdinal(raw: string): IToken[] | undefined {
  if (raw.length < 3) {
    return undefined;
  }

  const suffix = raw.slice(-2).toLowerCase();
  if (!ORDINAL_SUFFIXES.has(suffix)) {
    return undefined;
  }

  const prefix = raw.slice(0, -2);
  if (!isAllDigits(prefix) || prefix.length === 0 || prefix.length > 2) {
    return undefined;
  }

  const value = Number(prefix);
  if (value < 1 || value > MAX_ORDINAL_DAY) {
    return undefined;
  }

  return [
    {
      kind: ETokenKind.Ordinal,
      raw,
      value,
    },
  ];
}

function tryParseQuarter(raw: string): IToken[] | undefined {
  const lower = raw.toLowerCase();

  // "Q1" - "Q4"
  if (lower.length === 2 && lower[0] === 'q') {
    const digit = Number(lower[1]);
    if (digit >= MIN_QUARTER && digit <= MAX_QUARTER) {
      return [{ kind: ETokenKind.Quarter, raw, value: digit }];
    }
  }

  // "1Q" - "4Q"
  if (lower.length === 2 && lower[1] === 'q') {
    const digit = Number(lower[0]);
    if (digit >= MIN_QUARTER && digit <= MAX_QUARTER) {
      return [{ kind: ETokenKind.Quarter, raw, value: digit }];
    }
  }

  // "1Q25", "4q2025", "1q'25"
  if (lower.length >= 3 && lower[1] === 'q') {
    const digit = Number(lower[0]);
    if (digit >= MIN_QUARTER && digit <= MAX_QUARTER) {
      let yearPart = lower.slice(2);
      if (yearPart.startsWith("'")) {
        yearPart = yearPart.slice(1);
      }
      if (isAllDigits(yearPart) && yearPart.length >= 2 && yearPart.length <= 4) {
        return [
          { kind: ETokenKind.Quarter, raw: `${digit}q`, value: digit },
          {
            kind: ETokenKind.Number,
            raw: yearPart,
            value: normalizeYear(yearPart),
          },
        ];
      }
    }
  }

  return undefined;
}

function tryParseApostropheYear(raw: string): IToken[] | undefined {
  if (raw.length !== 3 || raw[0] !== "'" || !isDigit(raw[1]) || !isDigit(raw[2])) {
    return undefined;
  }

  const digits = raw.slice(1);
  return [
    {
      kind: ETokenKind.Number,
      raw,
      value: normalizeYear(digits),
    },
  ];
}

function tryParseAmPm(raw: string): IToken[] | undefined {
  const lower = raw.toLowerCase();
  if (lower !== 'am' && lower !== 'pm') {
    return undefined;
  }

  return [
    {
      kind: ETokenKind.AmPm,
      raw,
      value: lower === 'pm' ? NOON_HOUR : 0,
    },
  ];
}

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
