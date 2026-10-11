import type { ICardField, ICardState } from './card';
import type { TValidation } from './field-kinds/field-kind';
import { VALID } from './field-kinds/field-kind';
import { FIELD_KINDS } from './field-kinds/registry';

const SEVERITY: Readonly<Record<TValidation['kind'], number>> = {
  valid: 0,
  warning: 1,
  invalid: 2,
};

/**
 * The worst verdict over a field's values, each judged in the
 * canonical form "Save" will store. An invalid value keeps the card from
 * being saved; a warning (a failed checksum) is shown and saved anyway.
 */
export function validateField(field: ICardField, card: ICardState): TValidation {
  if (field.spec.kind === 'unknown') {
    return VALID;
  }
  const kind = FIELD_KINDS[field.spec.kind];
  const context = { spec: field.spec, card };
  const values = field.value.cardinality === 'single' ? [field.value.value] : field.value.values;
  return values
    .map(value => kind.validate(kind.normalize(value, context), context))
    .reduce(
      (worst, verdict) => (SEVERITY[verdict.kind] > SEVERITY[worst.kind] ? verdict : worst),
      VALID
    );
}
