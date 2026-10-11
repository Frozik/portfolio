/**
 * The control key of a Russian bank account (Bank of Russia
 * regulation 515): weights 7-1-3 over 23 digits — a three-digit prefix taken
 * from the BIC, then the 20 account digits — and the sum of the low digits
 * of the products is a multiple of ten.
 */
export const RU_ACCOUNT_LENGTH = 20;

const ACCOUNT_SHAPE = /^\d{5}[\dABCEHKMPTX]\d{14}$/;
const CORRESPONDENT_PREFIX = '30101';
const WEIGHTS = [7, 1, 3] as const;
const DECIMAL = 10;
const CLEARING_CURRENCY_POSITION = 5;
/** A letter in the sixth position marks a clearing currency; it is checked as this digit. */
const CLEARING_LETTER_DIGITS: Readonly<Record<string, string>> = {
  A: '0',
  B: '1',
  C: '2',
  E: '3',
  H: '4',
  K: '5',
  M: '6',
  P: '7',
  T: '8',
  X: '9',
};

export function isRussianAccountShape(account: string): boolean {
  return ACCOUNT_SHAPE.test(account);
}

function prefixFor(account: string, bic: string): string {
  return account.startsWith(CORRESPONDENT_PREFIX) ? `0${bic.slice(4, 6)}` : bic.slice(6, 9);
}

export function hasValidRussianAccountKey(account: string, bic: string): boolean {
  if (!isRussianAccountShape(account)) {
    return false;
  }
  const letter = account[CLEARING_CURRENCY_POSITION] ?? '';
  const digits =
    account.slice(0, CLEARING_CURRENCY_POSITION) +
    (CLEARING_LETTER_DIGITS[letter] ?? letter) +
    account.slice(CLEARING_CURRENCY_POSITION + 1);
  const keyed = prefixFor(account, bic) + digits;
  let sum = 0;
  for (let index = 0; index < keyed.length; index += 1) {
    sum += (Number(keyed[index]) * (WEIGHTS[index % WEIGHTS.length] ?? 0)) % DECIMAL;
  }
  return sum % DECIMAL === 0;
}
