import { defineFieldKind } from './field-kind';

export const LOGIN_FIELD = defineFieldKind({
  kind: 'login',
  sensitiveByDefault: false,
  listAllowed: false,
  searchable: true,
  defaultSpec: { kind: 'login' },
});
