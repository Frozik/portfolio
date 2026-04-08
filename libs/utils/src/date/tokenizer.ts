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
import {
  AMPM_REGEX,
  APOSTROPHE_YEAR_REGEX,
  COLON_TIME_REGEX,
  COLON_TIME_WITH_AMPM_REGEX,
  DURATION_TOKEN_REGEX,
  NUMBER_WITH_AMPM_REGEX,
  OFFSET_TOKEN_REGEX,
  ORDINAL_TOKEN_REGEX,
  QUARTER_N_TOKEN_REGEX,
  QUARTER_TOKEN_REGEX,
} from './patterns';
import { convertAmPmHour, normalizeMilliseconds, normalizeYear } from './slot-utils';
import type { IToken } from './token-types';
import { ETokenKind } from './token-types';

export function tokenize(input: string): IToken[] {
  const rawTokens = input.split(/[\s,]+/).filter(s => s.length > 0);
  const tokens: IToken[] = [];

  for (const raw of rawTokens) {
    const classified = classifySingleToken(raw);
    tokens.push(...classified);
  }

  return mergeMultiWordTokens(tokens);
}

export function mergeMultiWordTokens(tokens: IToken[]): IToken[] {
  const result: IToken[] = [];
  let i = 0;

  while (i < tokens.length) {
    if (
      tokens[i].raw.toLowerCase() === 'the' &&
      tokens[i].kind === ETokenKind.Unknown &&
      i + 1 < tokens.length &&
      tokens[i + 1].kind === ETokenKind.Ordinal
    ) {
      result.push(tokens[i + 1]);
      i += 2;
      continue;
    }

    if (i + 2 < tokens.length) {
      const threeWordKey = `${tokens[i].raw.toLowerCase()} ${tokens[i + 1].raw.toLowerCase()} ${tokens[i + 2].raw.toLowerCase()}`;
      const boundaryAlias = MULTI_WORD_BOUNDARY_MAP.get(threeWordKey);
      if (!isNil(boundaryAlias)) {
        result.push({
          kind: ETokenKind.BoundaryKeyword,
          raw: threeWordKey,
          value: 0,
        });
        i += 3;
        continue;
      }
    }

    if (
      tokens[i].raw.toLowerCase() === 'in' &&
      tokens[i].kind === ETokenKind.Unknown &&
      i + 2 < tokens.length &&
      tokens[i + 1].kind === ETokenKind.Number &&
      tokens[i + 2].kind === ETokenKind.Unit
    ) {
      result.push({
        kind: ETokenKind.Offset,
        raw: `${tokens[i].raw} ${tokens[i + 1].raw} ${tokens[i + 2].raw}`,
        value: tokens[i + 1].value,
        extra: tokens[i + 2].extra,
      });
      i += 3;
      continue;
    }

    if (
      tokens[i].kind === ETokenKind.Number &&
      i + 2 < tokens.length &&
      tokens[i + 1].kind === ETokenKind.Unit &&
      tokens[i + 2].raw.toLowerCase() === 'ago' &&
      tokens[i + 2].kind === ETokenKind.Unknown
    ) {
      result.push({
        kind: ETokenKind.Offset,
        raw: `${tokens[i].raw} ${tokens[i + 1].raw} ${tokens[i + 2].raw}`,
        value: -tokens[i].value,
        extra: tokens[i + 1].extra,
      });
      i += 3;
      continue;
    }

    if (
      tokens[i].kind === ETokenKind.Direction &&
      i + 1 < tokens.length &&
      tokens[i + 1].kind === ETokenKind.WeekdayName
    ) {
      result.push({
        kind: ETokenKind.Keyword,
        raw: `${tokens[i].raw} ${tokens[i + 1].raw}`,
        value: tokens[i].value,
        extra: `weekday:${tokens[i + 1].raw.toLowerCase()}`,
      });
      i += 2;
      continue;
    }

    result.push(tokens[i]);
    i++;
  }

  return result;
}

export function classifySingleToken(raw: string): IToken[] {
  const lower = raw.toLowerCase();

  const colonAmPmMatch = COLON_TIME_WITH_AMPM_REGEX.exec(raw);
  if (!isNil(colonAmPmMatch)) {
    const ampm = colonAmPmMatch[5].toLowerCase();
    const baseHour = Number(colonAmPmMatch[1]);
    const hour = convertAmPmHour(baseHour, ampm);

    if (!isNil(hour)) {
      const minute = Number(colonAmPmMatch[2]);
      const second = isNil(colonAmPmMatch[3]) ? 0 : Number(colonAmPmMatch[3]);
      const ms = isNil(colonAmPmMatch[4]) ? 0 : normalizeMilliseconds(colonAmPmMatch[4]);

      return [
        {
          kind: ETokenKind.ColonTime,
          raw,
          value: hour * 10000 + minute * 100 + second,
          extra: `${hour}:${minute}:${second}.${ms}`,
        },
      ];
    }
  }

  const colonMatch = COLON_TIME_REGEX.exec(raw);
  if (!isNil(colonMatch)) {
    const hour = Number(colonMatch[1]);
    const minute = Number(colonMatch[2]);
    const second = isNil(colonMatch[3]) ? 0 : Number(colonMatch[3]);
    const ms = isNil(colonMatch[4]) ? 0 : normalizeMilliseconds(colonMatch[4]);

    return [
      {
        kind: ETokenKind.ColonTime,
        raw,
        value: hour * 10000 + minute * 100 + second,
        extra: `${hour}:${minute}:${second}.${ms}`,
      },
    ];
  }

  const numAmPmMatch = NUMBER_WITH_AMPM_REGEX.exec(raw);
  if (!isNil(numAmPmMatch)) {
    const baseHour = Number(numAmPmMatch[1]);
    const ampm = numAmPmMatch[2].toLowerCase();
    const hour = convertAmPmHour(baseHour, ampm);

    if (!isNil(hour)) {
      return [
        {
          kind: ETokenKind.ColonTime,
          raw,
          value: hour * 10000,
          extra: `${hour}:0:0.0`,
        },
      ];
    }
  }

  const offsetMatch = OFFSET_TOKEN_REGEX.exec(raw);
  if (!isNil(offsetMatch)) {
    const direction = offsetMatch[1] === '+' ? 1 : -1;
    return [
      {
        kind: ETokenKind.Offset,
        raw,
        value: Number(offsetMatch[2]) * direction,
        extra: offsetMatch[3].toLowerCase(),
      },
    ];
  }

  const durationMatch = DURATION_TOKEN_REGEX.exec(raw);
  if (!isNil(durationMatch)) {
    return [
      {
        kind: ETokenKind.Duration,
        raw,
        value: Number(durationMatch[1]),
        extra: durationMatch[2].toLowerCase(),
      },
    ];
  }

  if (DATE_KEYWORD_SET.has(lower)) {
    return [{ kind: ETokenKind.Keyword, raw, value: 0 }];
  }

  if (TIME_KEYWORD_SET.has(lower)) {
    return [{ kind: ETokenKind.TimeKeyword, raw, value: 0 }];
  }

  if (BOUNDARY_KEYWORD_SET.has(lower)) {
    return [{ kind: ETokenKind.BoundaryKeyword, raw, value: 0 }];
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
    return [{ kind: ETokenKind.Direction, raw, value: lower === 'next' ? 1 : -1 }];
  }

  const unitChar = UNIT_MAP.get(lower);
  if (!isNil(unitChar)) {
    return [{ kind: ETokenKind.Unit, raw, value: 0, extra: unitChar }];
  }

  if (AMPM_REGEX.test(raw)) {
    return [{ kind: ETokenKind.AmPm, raw, value: lower === 'pm' ? NOON_HOUR : 0 }];
  }

  const quarterMatch = QUARTER_TOKEN_REGEX.exec(raw);
  if (!isNil(quarterMatch)) {
    return [{ kind: ETokenKind.Quarter, raw, value: Number(quarterMatch[1]) }];
  }

  const quarterNMatch = QUARTER_N_TOKEN_REGEX.exec(raw);
  if (!isNil(quarterNMatch)) {
    return [{ kind: ETokenKind.Quarter, raw, value: Number(quarterNMatch[1]) }];
  }

  const ordinalMatch = ORDINAL_TOKEN_REGEX.exec(raw);
  if (!isNil(ordinalMatch)) {
    return [{ kind: ETokenKind.Ordinal, raw, value: Number(ordinalMatch[1]) }];
  }

  const apostropheMatch = APOSTROPHE_YEAR_REGEX.exec(raw);
  if (!isNil(apostropheMatch)) {
    return [
      {
        kind: ETokenKind.Number,
        raw,
        value: normalizeYear(apostropheMatch[1]),
      },
    ];
  }

  if (/^\d+$/.test(raw)) {
    return [{ kind: ETokenKind.Number, raw, value: Number(raw) }];
  }

  return [{ kind: ETokenKind.Unknown, raw, value: 0 }];
}
