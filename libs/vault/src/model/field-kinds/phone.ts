import { defineFieldKind } from './field-kind';

const INTERNATIONAL_PUNCTUATION = /[\s().-]/g;

/** An international number (`+…`) is reduced to E.164; a local one is kept as typed. */
export const PHONE_FIELD = defineFieldKind({
  kind: 'phone',
  sensitiveByDefault: false,
  listAllowed: true,
  searchable: true,
  defaultSpec: { kind: 'phone' },
  normalize: value => {
    const trimmed = value.trim();
    return trimmed.startsWith('+') ? trimmed.replace(INTERNATIONAL_PUNCTUATION, '') : trimmed;
  },
});
