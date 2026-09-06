import { isNil } from 'lodash-es';

import { NOON_HOUR } from './constants';
import { isDigit } from './fsm-scan';
import { convertAmPmHour, normalizeMilliseconds, normalizeYear } from './slots';
import type { IToken } from './types';
import { ETokenKind } from './types';

/** The shapes one raw part may take — a colon time, an offset, a duration, an ordinal, a quarter, an AM/PM mark — each recognised on its own. */
export const COLON_TIME_VALUE_HOUR_MULTIPLIER = 10000;

const COLON_TIME_VALUE_MINUTE_MULTIPLIER = 100;

const MAX_ORDINAL_DAY = 31;

const MIN_QUARTER = 1;

const MAX_QUARTER = 4;

const ORDINAL_SUFFIXES = new Set(['st', 'nd', 'rd', 'th']);

const DURATION_UNIT_CHARS = new Set(['d', 'w', 'm', 'y']);

export function isAllDigits(value: string): boolean {
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

export function tryParseColonTime(raw: string): IToken[] | undefined {
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

export function tryParseNumberWithAmPm(raw: string): IToken[] | undefined {
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

export function tryParseOffset(raw: string): IToken[] | undefined {
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

export function tryParseDuration(raw: string): IToken[] | undefined {
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

export function tryParseOrdinal(raw: string): IToken[] | undefined {
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

export function tryParseQuarter(raw: string): IToken[] | undefined {
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

export function tryParseApostropheYear(raw: string): IToken[] | undefined {
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

export function tryParseAmPm(raw: string): IToken[] | undefined {
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
