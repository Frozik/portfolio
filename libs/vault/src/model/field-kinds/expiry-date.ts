import { defineFieldKind, invalid, VALID } from './field-kind';
import { parsePlainDate } from './plain-date';

export const EXPIRY_DATE_FIELD = defineFieldKind({
  kind: 'expiry-date',
  sensitiveByDefault: false,
  listAllowed: false,
  searchable: true,
  defaultSpec: { kind: 'expiry-date' },
  normalize: value => parsePlainDate(value)?.toString() ?? value.trim(),
  validate: value => (parsePlainDate(value)?.toString() === value ? VALID : invalid('date-format')),
});
