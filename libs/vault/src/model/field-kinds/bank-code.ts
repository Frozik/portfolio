import { BANK_CODE_SCHEMES } from '../validation/bank-codes';
import { defineFieldKind, VALID, warning } from './field-kind';

/**
 * A national bank code; the field's scheme says which (ABA
 * routing, sort code, BSB, …). `national` takes any other country's code
 * as typed, so nobody gets a warning for a format this build does not know.
 */
export const BANK_CODE_FIELD = defineFieldKind({
  kind: 'bank-code',
  sensitiveByDefault: false,
  listAllowed: false,
  searchable: true,
  defaultSpec: { kind: 'bank-code', scheme: 'national' },
  normalize: (value, { spec }) => BANK_CODE_SCHEMES[spec.scheme].normalize(value),
  validate: (value, { spec }) =>
    BANK_CODE_SCHEMES[spec.scheme].isValid(value) ? VALID : warning('bank-code-format'),
  format: (value, spec) => BANK_CODE_SCHEMES[spec.scheme].format(value),
});
