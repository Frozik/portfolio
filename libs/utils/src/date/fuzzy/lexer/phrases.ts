import { isNil } from 'lodash-es';

import { ESeparator } from './lexeme';
import type { IPhrase } from './phrase';
import { ofKind, phraseOfFour, phraseOfThree, phraseOfTwo, word } from './phrase';
import type { Meaning, Token, TokenOf } from './token';
import { EDateKeyword, EDirection, EMeridiem, EOffsetUnit, ETokenKind } from './token';
import { EDGES, PERIODS, boundaryOf } from './vocabulary';

const STEPS: Readonly<Record<EDirection, number>> = {
  [EDirection.Last]: -1,
  [EDirection.This]: 0,
  [EDirection.Next]: 1,
};

const TWO_DAYS = 2;

const isNumber = ofKind(ETokenKind.Number);
const isUnit = ofKind(ETokenKind.Unit);
const isDirection = ofKind(ETokenKind.Direction);
const isArticle = word('a', 'an');
const isEdge = word(...EDGES.keys());
const isPeriod = word(...PERIODS.keys());

function offset(amount: number, unit: EOffsetUnit): readonly Meaning[] {
  return [{ kind: ETokenKind.Offset, amount, unit }];
}

function boundary(
  edge: Token,
  period: Token,
  periodsAhead: number
): readonly Meaning[] | undefined {
  const edgeOf = EDGES.get(edge.text.toLowerCase());
  const periodOf = PERIODS.get(period.text.toLowerCase());

  return isNil(edgeOf) || isNil(periodOf)
    ? undefined
    : [boundaryOf(edgeOf, periodOf, periodsAhead)];
}

function dottedMeridiem(meridiem: EMeridiem) {
  return (_letter: Token, { joint }: Token): readonly Meaning[] | undefined =>
    joint === ESeparator.Dot ? [{ kind: ETokenKind.Meridiem, meridiem }] : undefined;
}

function isKeyword(keyword: EDateKeyword) {
  return (token: Token): token is TokenOf<ETokenKind.DateKeyword> =>
    token.kind === ETokenKind.DateKeyword && token.keyword === keyword;
}

/** Tried top to bottom at every position; the first phrase that reads the tokens replaces them. */
export const PHRASES: readonly IPhrase[] = [
  phraseOfTwo('p.m.', [word('p'), word('m')], dottedMeridiem(EMeridiem.Pm)),
  phraseOfTwo('a.m.', [word('a'), word('m')], dottedMeridiem(EMeridiem.Am)),
  phraseOfThree(
    '9.30pm',
    [isNumber, isNumber, ofKind(ETokenKind.Meridiem)],
    (hour, minute, meridiem) =>
      minute.joint === ESeparator.Dot
        ? [{ kind: ETokenKind.ClockTime, hour: hour.value, minute: minute.value }, meridiem]
        : undefined
  ),
  phraseOfFour(
    'end of next month',
    [isEdge, word('of'), isDirection, isPeriod],
    (edge, _of, { direction }, period) => boundary(edge, period, STEPS[direction])
  ),
  phraseOfThree('end of month', [isEdge, word('of'), isPeriod], (edge, _of, period) =>
    boundary(edge, period, STEPS[EDirection.This])
  ),
  phraseOfThree(
    'day after tomorrow',
    [word('day'), word('after'), isKeyword(EDateKeyword.Tomorrow)],
    () => offset(TWO_DAYS, EOffsetUnit.Day)
  ),
  phraseOfThree(
    'day before yesterday',
    [word('day'), word('before'), isKeyword(EDateKeyword.Yesterday)],
    () => offset(-TWO_DAYS, EOffsetUnit.Day)
  ),
  phraseOfThree('in 3 days', [word('in'), isNumber, isUnit], (_in, amount, { unit }) =>
    offset(amount.value, unit)
  ),
  phraseOfThree('in a week', [word('in'), isArticle, isUnit], (_in, _article, { unit }) =>
    offset(1, unit)
  ),
  phraseOfThree('3 days ago', [isNumber, isUnit, word('ago')], (amount, { unit }) =>
    offset(-amount.value, unit)
  ),
  phraseOfThree('a week ago', [isArticle, isUnit, word('ago')], (_article, { unit }) =>
    offset(-1, unit)
  ),
  phraseOfTwo('3 days', [isNumber, isUnit], (amount, { unit }) => offset(amount.value, unit)),
  phraseOfTwo('next week', [isDirection, isUnit], ({ direction }, { unit }) =>
    offset(STEPS[direction], unit)
  ),
  phraseOfTwo('next weekend', [isDirection, ofKind(ETokenKind.Weekend)], ({ direction }) => [
    { kind: ETokenKind.Weekend, weeksAhead: STEPS[direction] },
  ]),
  phraseOfTwo(
    'next friday',
    [isDirection, ofKind(ETokenKind.WeekdayName)],
    ({ direction }, { weekday }) => [{ kind: ETokenKind.RelativeWeekday, weekday, direction }]
  ),
];
