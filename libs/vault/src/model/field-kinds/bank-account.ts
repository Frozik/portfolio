import { isNil } from 'lodash-es';

import type { ICardState } from '../card';
import { allFields } from '../card';
import { BANK_CODE_SCHEMES } from '../validation/bank-codes';
import { hasValidRussianAccountKey, isRussianAccountShape } from '../validation/ru-account-key';
import { defineFieldKind, VALID, warning } from './field-kind';

const SEPARATORS = /[\s-]/g;

function russianBicOf(card: ICardState): string | null {
  for (const field of allFields(card)) {
    if (
      field.spec.kind === 'bank-code' &&
      field.spec.scheme === 'ru-bic' &&
      field.value.cardinality === 'single' &&
      BANK_CODE_SCHEMES['ru-bic'].isValid(field.value.value)
    ) {
      return field.value.value;
    }
  }
  return null;
}

/**
 * An account number of any country, kept as typed. Only a
 * national scheme with a public check digit is verified: next to a Russian
 * BIC on the same card, the Bank of Russia key; elsewhere there is nothing
 * to check, so nothing warns.
 */
export const BANK_ACCOUNT_FIELD = defineFieldKind({
  kind: 'bank-account',
  sensitiveByDefault: false,
  listAllowed: false,
  searchable: true,
  defaultSpec: { kind: 'bank-account' },
  normalize: value => value.replace(SEPARATORS, '').toUpperCase(),
  validate: (value, { card }) => {
    const bic = russianBicOf(card);
    if (isNil(bic)) {
      return VALID;
    }
    if (!isRussianAccountShape(value)) {
      return warning('bank-account-format');
    }
    return hasValidRussianAccountKey(value, bic) ? VALID : warning('bank-account-key');
  },
});
