import { isNil } from 'lodash-es';

import { SEPARATOR_SET, fsmScan } from './fsm-scan';
import { MULTI_WORD_BOUNDARY_MAP } from './lookups';
import { classifySingleToken } from './token-classifier';
import type { IToken } from './types';
import { ETokenKind } from './types';

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
