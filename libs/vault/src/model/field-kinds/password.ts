import { defineFieldKind } from './field-kind';

export const PASSWORD_FIELD = defineFieldKind({
  kind: 'password',
  sensitiveByDefault: true,
  listAllowed: true,
  searchable: false,
  defaultSpec: { kind: 'password', rotateEveryDays: null },
});
