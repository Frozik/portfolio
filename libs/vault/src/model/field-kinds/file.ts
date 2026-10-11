import { defineFieldKind } from './field-kind';

export const FILE_FIELD = defineFieldKind({
  kind: 'file',
  sensitiveByDefault: false,
  listAllowed: true,
  searchable: false,
  defaultSpec: { kind: 'file' },
});
