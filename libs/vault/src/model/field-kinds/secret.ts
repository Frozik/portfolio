import { defineFieldKind } from './field-kind';

export const SECRET_FIELD = defineFieldKind({
  kind: 'secret',
  sensitiveByDefault: true,
  listAllowed: true,
  searchable: false,
  defaultSpec: { kind: 'secret' },
});
