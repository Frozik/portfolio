import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

import type { TInputNormalizer } from './defs';

const MONTH_DIGITS = 2;
const YEAR_DIGITS = 2;
const MAX_DIGITS = MONTH_DIGITS + YEAR_DIGITS;
const SEPARATOR = '/';
/** Two-digit years are this century's: the field is for expiry dates, never for birthdays. */
const CENTURY = 2000;
const LAST_MONTH = 12;
/** A first digit above this cannot start a month, so it is the month itself: `5` → `05`. */
const HIGHEST_MONTH_TENS = 1;

/** `12/2029`, `3 / 2031`: a month and a four-digit year, as pasted from a card or a form. */
const MONTH_THEN_FULL_YEAR = /^\s*(\d{1,2})\s*[/.\-\s]\s*(\d{4})\s*$/;
/** `2029-12`: ISO 8601, as `Temporal.PlainYearMonth` prints it. */
const ISO_YEAR_MONTH = /^\s*(\d{4})-(\d{1,2})\s*$/;

/** Text naming a whole month with a four-digit year, rewritten as the `MMYY` digits the field holds. */
function fullYearDigits(text: string): string | undefined {
  const monthFirst = MONTH_THEN_FULL_YEAR.exec(text);
  const iso = ISO_YEAR_MONTH.exec(text);
  const [month, year] = monthFirst ? [monthFirst[1], monthFirst[2]] : iso ? [iso[2], iso[1]] : [];
  return isNil(month) || isNil(year)
    ? undefined
    : `${month.padStart(MONTH_DIGITS, '0')}${year.slice(-YEAR_DIGITS)}`;
}

function digitsOf(text: string): string {
  return text.replace(/\D/g, '');
}

/** The slash comes with the first year digit: one after the month alone could never be erased. */
function layout(digits: string): string {
  return digits.length <= MONTH_DIGITS
    ? digits
    : `${digits.slice(0, MONTH_DIGITS)}${SEPARATOR}${digits.slice(MONTH_DIGITS)}`;
}

/** A position in the laid-out text, counted from the digits before it. */
function positionOf(digitsBefore: number): number {
  return digitsBefore <= MONTH_DIGITS ? digitsBefore : digitsBefore + SEPARATOR.length;
}

/** `MM/YY` as one types it: digits only, the slash inserted, `5` read as May. */
export const normalizeMonthYearInput: TInputNormalizer = (value, selection) => {
  const whole = fullYearDigits(value);
  if (!isNil(whole)) {
    const text = layout(whole);
    return { value: text, selection: { start: text.length, end: text.length } };
  }
  const typed = digitsOf(value);
  const padded = Number(typed[0]) > HIGHEST_MONTH_TENS ? `0${typed}` : typed;
  const shift = padded.length - typed.length;
  const digits = padded.slice(0, MAX_DIGITS);
  const caret = (index: number) =>
    positionOf(Math.min(digits.length, digitsOf(value.slice(0, index)).length + shift));
  const text = layout(digits);
  return {
    value: text,
    selection: { start: caret(selection.start), end: caret(selection.end) },
  };
};

export function formatMonthYear(value: Temporal.PlainYearMonth | undefined): string {
  if (isNil(value)) {
    return '';
  }
  return layout(
    `${String(value.month).padStart(MONTH_DIGITS, '0')}${String(value.year % 100).padStart(YEAR_DIGITS, '0')}`
  );
}

export type TMonthYearParse =
  | { readonly kind: 'empty' }
  | { readonly kind: 'incomplete' }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'value'; readonly value: Temporal.PlainYearMonth };

export function parseMonthYear(text: string): TMonthYearParse {
  const digits = digitsOf(text);
  if (digits.length === 0) {
    return { kind: 'empty' };
  }
  if (digits.length < MAX_DIGITS) {
    return { kind: 'incomplete' };
  }
  const month = Number(digits.slice(0, MONTH_DIGITS));
  if (month < 1 || month > LAST_MONTH) {
    return { kind: 'invalid' };
  }
  const year = CENTURY + Number(digits.slice(MONTH_DIGITS, MAX_DIGITS));
  return { kind: 'value', value: Temporal.PlainYearMonth.from({ year, month }) };
}

/**
 * Whole text read as a month, for callers that get it at once (agent tools):
 * `MM/YY`, `MM/YYYY` or ISO `YYYY-MM`. Unlike typing, extra digits make it
 * invalid rather than being cut off.
 */
export function readMonthYearText(text: string): TMonthYearParse {
  const whole = fullYearDigits(text);
  if (!isNil(whole)) {
    return parseMonthYear(whole);
  }
  return digitsOf(text).length > MAX_DIGITS ? { kind: 'invalid' } : parseMonthYear(text);
}
