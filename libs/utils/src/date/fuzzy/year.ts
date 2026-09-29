const CENTURY = 100;
const TWO_DIGIT_YEAR_PIVOT = 50;
const CURRENT_CENTURY_START = 2000;
const PREVIOUS_CENTURY_START = 1900;

/** Two-digit years below the pivot belong to the 2000s, the rest to the 1900s: 27 → 2027, 82 → 1982. */
export function toFullYear(year: number): number {
  if (year >= CENTURY) {
    return year;
  }
  return year < TWO_DIGIT_YEAR_PIVOT ? CURRENT_CENTURY_START + year : PREVIOUS_CENTURY_START + year;
}
