import { defineFieldKind } from './field-kind';

/** The question is open, the value is the answer and is secret. */
export const SECURITY_QUESTION_FIELD = defineFieldKind({
  kind: 'security-question',
  sensitiveByDefault: true,
  listAllowed: false,
  searchable: false,
  defaultSpec: { kind: 'security-question', question: '' },
});
