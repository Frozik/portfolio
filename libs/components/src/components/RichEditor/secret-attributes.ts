/**
 * What keeps a secret away from other password managers,
 * Grammarly and spell-checking services. Set by the controls themselves, so
 * no owner can forget one, and kept while the value is shown.
 */
export const SECRET_FIELD_ATTRIBUTES = {
  'data-1p-ignore': true,
  'data-lpignore': 'true',
  'data-bwignore': true,
  'data-form-type': 'other',
  'data-gramm': 'false',
  'data-gramm_editor': 'false',
  'data-enable-grammarly': 'false',
} as const;
