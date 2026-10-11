const DECIMAL = 10;
const DOUBLED_OVERFLOW = 9;
const DIGITS_ONLY = /^\d+$/;

/** ISO/IEC 7812-1 check digit over a digits-only string. */
export function hasValidLuhnChecksum(digits: string): boolean {
  if (!DIGITS_ONLY.test(digits)) {
    return false;
  }
  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    const digit = Number(digits[digits.length - 1 - index]);
    const doubled = index % 2 === 1 ? digit * 2 : digit;
    sum += doubled > DOUBLED_OVERFLOW ? doubled - DOUBLED_OVERFLOW : doubled;
  }
  return sum % DECIMAL === 0;
}
