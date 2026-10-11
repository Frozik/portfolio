import { electronicFormatIBAN, friendlyFormatIBAN, isValidIBAN } from 'ibantools';

import { defineFieldKind, VALID, warning } from './field-kind';

/** Length by country and mod 97 (ISO 13616) through ibantools; a failure only warns. */
export const IBAN_FIELD = defineFieldKind({
  kind: 'iban',
  sensitiveByDefault: false,
  listAllowed: false,
  searchable: true,
  defaultSpec: { kind: 'iban' },
  normalize: value => electronicFormatIBAN(value) ?? value,
  validate: value => (isValidIBAN(value) ? VALID : warning('iban-checksum')),
  format: value => friendlyFormatIBAN(value) ?? value,
  copyValue: value => electronicFormatIBAN(value) ?? value,
});
