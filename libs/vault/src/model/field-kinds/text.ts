import { defineFieldKind } from './field-kind';

export const TEXT_FIELD = defineFieldKind({
  kind: 'text',
  sensitiveByDefault: false,
  listAllowed: true,
  searchable: true,
  defaultSpec: { kind: 'text' },
});
