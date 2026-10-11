import { defineFieldKind, invalid, VALID } from './field-kind';

/** `'true' | 'false'`, so rules of smart groups can test it. */
export const BOOLEAN_FIELD = defineFieldKind({
  kind: 'boolean',
  sensitiveByDefault: false,
  listAllowed: false,
  searchable: false,
  defaultSpec: { kind: 'boolean' },
  validate: value => (value === 'true' || value === 'false' ? VALID : invalid('boolean-format')),
});
