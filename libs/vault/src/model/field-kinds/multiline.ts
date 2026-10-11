import { defineFieldKind } from './field-kind';

export const MULTILINE_FIELD = defineFieldKind({
  kind: 'multiline',
  sensitiveByDefault: false,
  listAllowed: false,
  searchable: true,
  defaultSpec: { kind: 'multiline' },
});
