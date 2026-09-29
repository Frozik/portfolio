import { ETokenKind } from '../lexer/token';
import { DATE_SLOTS, ESlot, TIME_SLOTS } from '../slot';
import { allOf, has, not, someNumbersAreJoined, wordsNameTheDayOrMonth } from './board-conditions';
import {
  both,
  comesRightAfter,
  isFullYear,
  isJoinedByDateSeparator,
  isWrittenAfterAnOffset,
  standsForTheHourBeforeMeridiem,
  standsForTheMinuteBeforeMeridiem,
  standsForTheDay,
  standsForTheYear,
  unless,
} from './number-tests';
import { READING_ORDERS } from './reading-orders';
import type { IScoringRule } from './rule';
import { close, readInOrder, settle } from './rule';
import { slotsStatedByWords } from './stated-slots';

/** Applied top to bottom; each rule sees the weights the rules above have left. */
export const SCORING_RULES: readonly IScoringRule[] = [
  close('what the words state, no number can be', { slots: slotsStatedByWords }),
  close('an ordinal without a month is a day of the month at hand', {
    when: allOf(has(ETokenKind.Ordinal), not(has(ETokenKind.MonthName))),
    slots: [ESlot.Year, ESlot.Month],
  }),

  settle('the number before am or pm is the hour', {
    whose: standsForTheHourBeforeMeridiem,
    slot: ESlot.Hour,
  }),
  settle('too large for the dial, the number before am or pm is the minute', {
    whose: standsForTheMinuteBeforeMeridiem,
    slot: ESlot.Minute,
  }),
  settle('the number beside the month name is the day', {
    whose: standsForTheDay,
    slot: ESlot.Day,
  }),
  settle('a number after the date, too large for an hour, is the year', {
    whose: standsForTheYear,
    slot: ESlot.Year,
  }),
  close('beside a day or month told in words, the other numbers are the time', {
    when: wordsNameTheDayOrMonth,
    whose: unless(standsForTheDay, standsForTheYear, isFullYear),
    slots: DATE_SLOTS,
  }),

  close('a loose number written after an offset is the time', {
    whose: both(
      isWrittenAfterAnOffset,
      unless(isJoinedByDateSeparator, standsForTheDay, standsForTheYear, isFullYear)
    ),
    slots: DATE_SLOTS,
  }),

  close('numbers joined by a date separator are the date', {
    whose: isJoinedByDateSeparator,
    slots: TIME_SLOTS,
  }),
  close('beside a date written with separators, the loose numbers are the time', {
    when: someNumbersAreJoined,
    whose: unless(isJoinedByDateSeparator, standsForTheYear, isFullYear),
    slots: DATE_SLOTS,
  }),
  close('a minute is written right after its hour', {
    whose: unless(comesRightAfter(ESlot.Hour)),
    slots: [ESlot.Minute],
  }),
  close('a second is written right after its minute', {
    whose: unless(comesRightAfter(ESlot.Minute)),
    slots: [ESlot.Second],
  }),
  close('a millisecond is written right after its second', {
    whose: unless(comesRightAfter(ESlot.Second)),
    slots: [ESlot.Millisecond],
  }),

  readInOrder('the numbers are read in the order people write them', READING_ORDERS),
];
