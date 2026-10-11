import { isValidBIC } from 'ibantools';

import { defineFieldKind, VALID, warning } from './field-kind';

const SPACES = /\s/g;

/** The international SWIFT/BIC (ISO 9362, 8 or 11 characters); national codes are `bank-code`. */
export const BIC_FIELD = defineFieldKind({
  kind: 'bic',
  sensitiveByDefault: false,
  listAllowed: false,
  searchable: true,
  defaultSpec: { kind: 'bic' },
  normalize: value => value.replace(SPACES, '').toUpperCase(),
  validate: value => (isValidBIC(value) ? VALID : warning('bic-format')),
});
