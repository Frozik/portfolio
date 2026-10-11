import { defineFieldKind } from './field-kind';

export const NOTE_FIELD = defineFieldKind({
  kind: 'note',
  sensitiveByDefault: false,
  listAllowed: false,
  searchable: true,
  defaultSpec: { kind: 'note' },
});
