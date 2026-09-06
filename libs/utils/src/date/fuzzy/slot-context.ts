import { isWeekdayKeyword } from './scoring';
import type { ISlotContext, IToken } from './types';
import { ESeparatorKind, ETokenKind } from './types';

/** What the tokens already settle before scoring — known slots, AM/PM, weekdays — and the conflicts that rule an input out. */
export function detectConflicts(tokens: IToken[]): string | undefined {
  const dateKeywords: IToken[] = [];
  const timeKeywords: IToken[] = [];
  const colonTimes: IToken[] = [];
  const offsets: IToken[] = [];
  const durations: IToken[] = [];
  const monthNames: IToken[] = [];

  for (const token of tokens) {
    switch (token.kind) {
      case ETokenKind.Keyword:
        dateKeywords.push(token);
        break;
      case ETokenKind.TimeKeyword:
        timeKeywords.push(token);
        break;
      case ETokenKind.Offset:
        offsets.push(token);
        break;
      case ETokenKind.Duration:
        durations.push(token);
        break;
      case ETokenKind.ColonTime:
        colonTimes.push(token);
        break;
      case ETokenKind.MonthName:
        monthNames.push(token);
        break;
      default:
        break;
    }
  }

  if (dateKeywords.length > 1) {
    return `Conflicting date keywords: "${dateKeywords[0].raw}" and "${dateKeywords[1].raw}"`;
  }

  const allTimeSources = [...timeKeywords, ...colonTimes];
  if (allTimeSources.length > 1) {
    return `Conflicting time specifications: "${allTimeSources[0].raw}" and "${allTimeSources[1].raw}"`;
  }

  if (dateKeywords.length > 0 && (offsets.length > 0 || durations.length > 0)) {
    const conflicting = offsets.length > 0 ? offsets[0] : durations[0];
    return `Cannot combine date keyword "${dateKeywords[0].raw}" with offset/duration "${conflicting.raw}"`;
  }

  if (monthNames.length > 1) {
    return `Conflicting month names: "${monthNames[0].raw}" and "${monthNames[1].raw}"`;
  }

  return undefined;
}

export function buildSlotContext(tokens: IToken[]): ISlotContext {
  let colonCount = 0;
  let datePartCount = 0;
  let hasDotAfterColon = false;
  let seenColon = false;

  for (const token of tokens) {
    if (token.kind === ETokenKind.Separator) {
      if (token.raw === ESeparatorKind.Colon) {
        colonCount++;
        seenColon = true;
      } else if (
        token.raw === ESeparatorKind.Dash ||
        token.raw === ESeparatorKind.Slash ||
        token.raw === ESeparatorKind.Dot
      ) {
        if (seenColon && token.raw === ESeparatorKind.Dot) {
          hasDotAfterColon = true;
        } else {
          datePartCount++;
        }
      }
    }
  }

  return {
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
      token => token.kind === ETokenKind.WeekdayName || isWeekdayKeyword(token)
    ),
    hasQuarter: tokens.some(token => token.kind === ETokenKind.Quarter),
    colonCount,
    datePartCount,
    hasDotAfterColon,
  };
}
