import { isNil } from 'lodash-es';
import { Temporal } from 'temporal-polyfill';

const ISO_MONTH = /^(\d{4})-(\d{2})$/;
const CARD_MONTH = /^(\d{1,2})\s*\/\s*(\d{2}|\d{4})$/;
const CENTURY = 2000;
const TWO_DIGIT_YEAR = 2;
const MAX_MONTH = 12;

function yearMonth(year: number, month: number): Temporal.PlainYearMonth | null {
  return month >= 1 && month <= MAX_MONTH ? new Temporal.PlainYearMonth(year, month) : null;
}

/** `2027-12`, `12/27` and `12/2027` are the same month; anything else is not a month. */
export function parseYearMonth(value: string): Temporal.PlainYearMonth | null {
  const trimmed = value.trim();
  const iso = ISO_MONTH.exec(trimmed);
  if (!isNil(iso)) {
    return yearMonth(Number(iso[1]), Number(iso[2]));
  }
  const card = CARD_MONTH.exec(trimmed);
  if (isNil(card)) {
    return null;
  }
  const year = card[2] ?? '';
  return yearMonth(
    year.length === TWO_DIGIT_YEAR ? CENTURY + Number(year) : Number(year),
    Number(card[1])
  );
}
