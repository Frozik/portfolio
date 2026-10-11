import { defineFieldKind, invalid, VALID } from './field-kind';
import { parsePlainDate } from './plain-date';

export const DATE_FIELD = defineFieldKind({
  kind: 'date',
  sensitiveByDefault: false,
  listAllowed: false,
  searchable: true,
  defaultSpec: { kind: 'date' },
  normalize: value => parsePlainDate(value)?.toString() ?? value.trim(),
  validate: value => (parsePlainDate(value)?.toString() === value ? VALID : invalid('date-format')),
});
