export const MONTHS_IN_YEAR = 12;
export const LONGEST_MONTH = 31;
export const HOURS_ON_THE_DIAL = 12;

export function isWithin(value: number, first: number, last: number): boolean {
  return Number.isInteger(value) && value >= first && value <= last;
}
