import { defineFieldKind, invalid, VALID } from './field-kind';

const DIGITS = /^\d+$/;

export const PIN_FIELD = defineFieldKind({
  kind: 'pin',
  sensitiveByDefault: true,
  listAllowed: false,
  searchable: false,
  defaultSpec: { kind: 'pin' },
  normalize: value => value.trim(),
  validate: value => (DIGITS.test(value) ? VALID : invalid('digits-only')),
});
