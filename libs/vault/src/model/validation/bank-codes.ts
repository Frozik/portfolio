import type { TBankCodeScheme } from '../card';

interface IBankCodeScheme {
  readonly normalize: (value: string) => string;
  readonly isValid: (value: string) => boolean;
  readonly format: (value: string) => string;
}

const SEPARATORS = /[\s.-]/g;
const ABA_WEIGHTS = [3, 7, 1] as const;
const DECIMAL = 10;
const SORT_CODE_PAIR = /(\d{2})(?=\d)/g;
const BSB_SPLIT = 3;

const compact = (value: string): string => value.replace(SEPARATORS, '').toUpperCase();
const asTyped = (value: string): string => value;

/** ABA routing number: nine digits whose weighted sum (3, 7, 1, …) is a multiple of ten. */
export function hasValidAbaChecksum(routing: string): boolean {
  if (!/^\d{9}$/.test(routing)) {
    return false;
  }
  let sum = 0;
  for (let index = 0; index < routing.length; index += 1) {
    sum += Number(routing[index]) * (ABA_WEIGHTS[index % ABA_WEIGHTS.length] ?? 0);
  }
  return sum % DECIMAL === 0;
}

/** One row per national scheme: how it is typed, checked and shown. */
export const BANK_CODE_SCHEMES: Readonly<Record<TBankCodeScheme, IBankCodeScheme>> = {
  /** Any other country's code (a German BLZ, a French code banque): kept as typed, never checked. */
  national: { normalize: value => value.trim(), isValid: () => true, format: asTyped },
  'aba-routing': { normalize: compact, isValid: hasValidAbaChecksum, format: asTyped },
  /** Canada: the electronic form `0` + institution (3) + transit (5). */
  'ca-routing': { normalize: compact, isValid: value => /^0\d{8}$/.test(value), format: asTyped },
  'sort-code': {
    normalize: compact,
    isValid: value => /^\d{6}$/.test(value),
    format: value => value.replace(SORT_CODE_PAIR, '$1-'),
  },
  bsb: {
    normalize: compact,
    isValid: value => /^\d{6}$/.test(value),
    format: value =>
      value.length === 6 ? `${value.slice(0, BSB_SPLIT)}-${value.slice(BSB_SPLIT)}` : value,
  },
  /** India: four letters of the bank, a zero, six characters of the branch. */
  ifsc: {
    normalize: compact,
    isValid: value => /^[A-Z]{4}0[A-Z\d]{6}$/.test(value),
    format: asTyped,
  },
  /** Russia: nine digits, `04` for banks, `01` for the Treasury. */
  'ru-bic': { normalize: compact, isValid: value => /^0[14]\d{7}$/.test(value), format: asTyped },
};
