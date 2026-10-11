import { isNil } from 'lodash-es';

export interface ISecretInputFormat {
  /** PIN, CVV: digits only, typed on a numeric keyboard. */
  readonly digitsOnly?: boolean;
  readonly maxLength?: number;
}

const NON_DIGIT = /\D/;

/**
 * What an edit of a secret may become: digits only and a
 * length cap where the format asks; `undefined` rejects the edit. A pasted
 * `1234 5678` becomes `12345678`; letters typed into a PIN are refused.
 */
export function normalizeSecretInput(
  next: string,
  { digitsOnly = false, maxLength }: ISecretInputFormat
): string | undefined {
  const cleaned = digitsOnly ? next.replace(/[\s-]/g, '') : next;
  if (digitsOnly && NON_DIGIT.test(cleaned)) {
    return undefined;
  }
  return isNil(maxLength) || cleaned.length <= maxLength ? cleaned : undefined;
}
