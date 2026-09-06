import { isNil } from 'lodash-es';
import type { IToken } from './types';
import { EParseTemporality, ETokenKind } from './types';

/** Whether a parsed expression points at the past, the present or the future, read off its tokens. */
export function deriveTemporality(tokens: IToken[], hasResolvedYear: boolean): EParseTemporality {
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
