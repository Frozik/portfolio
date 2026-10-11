import { defineFieldKind, warning, VALID } from './field-kind';

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const EMAIL_FIELD = defineFieldKind({
  kind: 'email',
  sensitiveByDefault: false,
  listAllowed: true,
  searchable: true,
  defaultSpec: { kind: 'email' },
  normalize: value => value.trim(),
  validate: value => (EMAIL_SHAPE.test(value) ? VALID : warning('email-format')),
});
