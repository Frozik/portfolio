import { defineFieldKind, invalid, VALID } from './field-kind';

export const SELECT_FIELD = defineFieldKind({
  kind: 'select',
  sensitiveByDefault: false,
  listAllowed: true,
  searchable: true,
  defaultSpec: { kind: 'select', options: [], allowCustom: true },
  normalize: value => value.trim(),
  validate: (value, { spec }) =>
    spec.allowCustom || spec.options.includes(value) ? VALID : invalid('not-an-option'),
});
