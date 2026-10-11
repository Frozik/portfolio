import { isNil } from 'lodash-es';

import { detectCardNetwork, groupCardNumber } from '../card-network';
import { hasValidLuhnChecksum } from '../validation/luhn';
import { defineFieldKind, invalid, VALID, warning } from './field-kind';

const SEPARATORS = /[\s-]/g;
const DIGITS = /^\d+$/;

/** A failed Luhn check or an unusual length warns; it never blocks. */
export const CARD_NUMBER_FIELD = defineFieldKind({
  kind: 'card-number',
  sensitiveByDefault: true,
  listAllowed: false,
  searchable: false,
  defaultSpec: { kind: 'card-number' },
  normalize: value => value.replace(SEPARATORS, ''),
  validate: value => {
    if (!DIGITS.test(value)) {
      return invalid('digits-only');
    }
    const lengths = detectCardNetwork(value)?.lengths;
    if (!isNil(lengths) && !lengths.includes(value.length)) {
      return warning('card-length');
    }
    return hasValidLuhnChecksum(value) ? VALID : warning('luhn');
  },
  format: groupCardNumber,
  copyValue: value => value.replace(SEPARATORS, ''),
});
