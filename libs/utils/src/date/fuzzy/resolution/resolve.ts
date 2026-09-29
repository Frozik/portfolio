import { compact, difference, isEmpty, isNil, uniq } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

import type { Token, TokenOf } from '../lexer/token';
import { EOffsetUnit, ETokenKind } from '../lexer/token';
import type { ICandidate } from '../scoring/scoreboard';
import { tokensThatState } from '../scoring/stated-slots';
import type { SlotValues } from '../slot';
import { ALL_SLOTS, ESlot, TIME_SLOTS } from '../slot';
import { assignSlots } from './assign-slots';
import { shifted } from './calendar';
import { hourOnTheDial, timeOfDay } from './clock';
import { dateShapeOf } from './date-shapes';
import { dateValues, timeValues, valuesStatedBy } from './word-values';

export interface IResolveOptions {
  readonly now: Temporal.ZonedDateTime;
  readonly nearest: boolean;
}

const MEANINGLESS_ALONE: ReadonlySet<ETokenKind> = new Set([
  ETokenKind.Unknown,
  ETokenKind.Direction,
  ETokenKind.Unit,
]);

const UNITS_OF_THE_CLOCK: ReadonlySet<EOffsetUnit> = new Set([
  EOffsetUnit.Hour,
  EOffsetUnit.Minute,
  EOffsetUnit.Second,
]);

function ofKind<Kind extends ETokenKind>(
  tokens: readonly Token[],
  kind: Kind
): readonly TokenOf<Kind>[] {
  return tokens.filter((token): token is TokenOf<Kind> => token.kind === kind);
}

/** A slot told twice — "tom yesterday", "jan feb" — is a contradiction, not a choice to make. */
function combined(statements: readonly SlotValues[]): SlotValues | undefined {
  const told = statements.flatMap(statement =>
    ALL_SLOTS.flatMap(slot => (isNil(statement[slot]) ? [] : [[slot, statement[slot]] as const]))
  );
  const slots = told.map(([slot]) => slot);

  return uniq(slots).length === slots.length ? Object.fromEntries(told) : undefined;
}

function toldValues(
  tokens: readonly Token[],
  candidates: readonly ICandidate[],
  now: Temporal.ZonedDateTime
): SlotValues | undefined {
  const assigned = assignSlots(candidates);
  if (isNil(assigned) || tokens.some(token => MEANINGLESS_ALONE.has(token.kind))) {
    return undefined;
  }
  return combined([...tokensThatState(tokens).map(token => valuesStatedBy(token, now)), assigned]);
}

/** With nothing else said, an offset starts from today — from this very moment when it counts hours or minutes. */
function startOf(
  offsets: readonly TokenOf<ETokenKind.Offset>[],
  now: Temporal.ZonedDateTime
): SlotValues {
  if (isEmpty(offsets)) {
    return {};
  }
  const today = dateValues(now.toPlainDate());

  return offsets.some(({ unit }) => UNITS_OF_THE_CLOCK.has(unit))
    ? { ...today, ...timeValues(now.toPlainTime()) }
    : today;
}

/** "evening" with no time beside it is the hour the evening usually means. */
function withUsualHour(
  values: SlotValues,
  dayParts: readonly TokenOf<ETokenKind.DayPart>[]
): SlotValues {
  const [dayPart] = dayParts;
  const tellsTime = TIME_SLOTS.some(slot => !isNil(values[slot]));

  return isNil(dayPart) || tellsTime
    ? values
    : { ...values, [ESlot.Hour]: hourOnTheDial(dayPart.hour, dayPart.meridiem) };
}

/** A part of the day and a time in words — "tonight noon", "morning evening" — say the same thing twice. */
function tellsThePartOfDayTwice(tokens: readonly Token[]): boolean {
  const parts = ofKind(tokens, ETokenKind.DayPart).length;

  return parts > 1 || (parts > 0 && !isEmpty(ofKind(tokens, ETokenKind.TimeKeyword)));
}

function shiftedBy(
  offsets: readonly TokenOf<ETokenKind.Offset>[],
  moment: Temporal.ZonedDateTime
): Temporal.ZonedDateTime | undefined {
  return offsets.reduce<Temporal.ZonedDateTime | undefined>(
    (shiftedSoFar, { amount, unit }) =>
      isNil(shiftedSoFar) ? undefined : shifted(shiftedSoFar, amount, unit),
    moment
  );
}

/** "fri 13th": of the dates the rest may mean, a weekday that only confirms keeps the ones that fall on it. */
function confirmedBy(
  tokens: readonly Token[],
  dates: readonly Temporal.PlainDate[]
): readonly Temporal.PlainDate[] {
  const weekdays = difference(tokens, tokensThatState(tokens)).flatMap(token =>
    token.kind === ETokenKind.WeekdayName || token.kind === ETokenKind.RelativeWeekday
      ? [token.weekday]
      : []
  );

  return dates.filter(date => weekdays.every(weekday => date.dayOfWeek === weekday));
}

export function resolve(
  tokens: readonly Token[],
  candidates: readonly ICandidate[],
  { now, nearest }: IResolveOptions
): Temporal.ZonedDateTime | undefined {
  const offsets = ofKind(tokens, ETokenKind.Offset);
  const dayParts = ofKind(tokens, ETokenKind.DayPart);
  const told = toldValues(tokens, candidates, now);
  if (isNil(told) || tellsThePartOfDayTwice(tokens)) {
    return undefined;
  }
  const values = withUsualHour(isEmpty(told) ? startOf(offsets, now) : told, dayParts);
  if (isEmpty(values)) {
    return undefined;
  }

  const time = timeOfDay(values, {
    told: ofKind(tokens, ETokenKind.Meridiem).map(({ meridiem }) => meridiem),
    implied: dayParts[0]?.meridiem,
  });
  const occurrences = dateShapeOf(values)?.occurrences(values, now.toPlainDate());
  const [zone = now.timeZoneId, ...extraZones] = ofKind(tokens, ETokenKind.ZoneOffset).map(
    token => token.zone
  );
  if (isNil(time) || isNil(occurrences) || !isEmpty(extraZones)) {
    return undefined;
  }

  const moments = confirmedBy(tokens, occurrences).map(date =>
    shiftedBy(
      offsets,
      date.toZonedDateTime({ timeZone: zone, plainTime: time }).withTimeZone(now.timeZoneId)
    )
  );
  const notBefore = nearest ? now.startOfDay() : now;
  if (moments.some(isNil)) {
    return undefined;
  }

  return (
    compact(moments).find(moment => Temporal.ZonedDateTime.compare(moment, notBefore) >= 0) ??
    moments[0]
  );
}
