import { isNil } from 'lodash-es';

import { assertNever } from '../../../assert/assertNever';
import type { Token } from '../lexer/token';
import { EDateKeyword, EEdge, EPeriod, ETokenKind } from '../lexer/token';
import { ALL_SLOTS, DATE_SLOTS, ESlot, TIME_SLOTS } from '../slot';
import { isJoinedIntoDate } from './joints';
import type { IScoreboard } from './scoreboard';

const NOTHING: readonly ESlot[] = [];

/** The slots a token settles on its own, leaving no room there for a number. */
export function slotsStatedBy(token: Token): readonly ESlot[] {
  switch (token.kind) {
    case ETokenKind.DateKeyword:
      return token.keyword === EDateKeyword.Now ? ALL_SLOTS : DATE_SLOTS;
    case ETokenKind.WeekdayName:
    case ETokenKind.RelativeWeekday:
    case ETokenKind.Weekend:
      return DATE_SLOTS;
    case ETokenKind.Boundary:
      return token.edge === EEdge.End && token.period === EPeriod.Day ? ALL_SLOTS : DATE_SLOTS;
    case ETokenKind.Quarter:
      return [ESlot.Month, ESlot.Day];
    case ETokenKind.MonthName:
      return [ESlot.Month];
    case ETokenKind.Ordinal:
      return [ESlot.Day];
    case ETokenKind.Year:
      return [ESlot.Year];
    case ETokenKind.TimeKeyword:
      return TIME_SLOTS;
    case ETokenKind.ClockTime:
      return [
        ESlot.Hour,
        ESlot.Minute,
        ...(isNil(token.second) ? [] : [ESlot.Second]),
        ...(isNil(token.millisecond) ? [] : [ESlot.Millisecond]),
      ];
    case ETokenKind.Number:
    case ETokenKind.Offset:
    case ETokenKind.Meridiem:
    case ETokenKind.DayPart:
    case ETokenKind.ZoneOffset:
    case ETokenKind.Direction:
    case ETokenKind.Unit:
    case ETokenKind.Filler:
    case ETokenKind.Unknown:
      return NOTHING;
    default:
      return assertNever(token);
  }
}

function isWeekday({ kind }: Token): boolean {
  return kind === ETokenKind.WeekdayName || kind === ETokenKind.RelativeWeekday;
}

/**
 * Alone, a weekday tells the date: "fri". Beside a date told some other way it only
 * confirms it: "fri 21 jun" is the 21st of June that falls on a Friday.
 */
export function weekdaysOnlyConfirm(tokens: readonly Token[]): boolean {
  const toldOtherwise = tokens.filter(token => !isWeekday(token)).flatMap(slotsStatedBy);

  return (
    toldOtherwise.some(slot => DATE_SLOTS.includes(slot)) ||
    tokens.some((_token, position) => isJoinedIntoDate(tokens, position))
  );
}

export function tokensThatState(tokens: readonly Token[]): readonly Token[] {
  return weekdaysOnlyConfirm(tokens) ? tokens.filter(token => !isWeekday(token)) : tokens;
}

export function slotsStatedByWords({ tokens }: IScoreboard): readonly ESlot[] {
  return tokensThatState(tokens).flatMap(slotsStatedBy);
}
