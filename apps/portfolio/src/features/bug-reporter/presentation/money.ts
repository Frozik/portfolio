import { formatNumber } from '@frozik/table/core/format/formatNumber';

/** Numbers in the demo always read `64,206.71`, whatever the UI language. */
export const NUMBER_LOCALE = 'en';
const MONEY_DIGITS = 2;

export function formatMoney(value: number, currency?: string): string {
  const amount = formatNumber(value, { locale: NUMBER_LOCALE, digits: MONEY_DIGITS });
  return currency === undefined ? amount : `${amount} ${currency}`;
}
