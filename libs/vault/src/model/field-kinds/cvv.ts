import { defineFieldKind, warning, VALID } from './field-kind';

const CVV = /^\d{3,4}$/;

export const CVV_FIELD = defineFieldKind({
  kind: 'cvv',
  sensitiveByDefault: true,
  listAllowed: false,
  searchable: false,
  defaultSpec: { kind: 'cvv' },
  normalize: value => value.trim(),
  validate: value => (CVV.test(value) ? VALID : warning('cvv-length')),
});
