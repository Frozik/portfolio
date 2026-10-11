import { isNil } from 'lodash-es';

import { parseUrl } from '../parse-url';
import { defineFieldKind, invalid, VALID } from './field-kind';

const HAS_SCHEME = /^[a-z][a-z\d+.-]*:/i;

/** `https://` when no scheme is typed; matched by host unless the field says otherwise. */
export const URL_FIELD = defineFieldKind({
  kind: 'url',
  sensitiveByDefault: false,
  listAllowed: true,
  searchable: true,
  defaultSpec: { kind: 'url', match: 'host', useSharedCredentials: true },
  normalize: value => {
    const trimmed = value.trim();
    return trimmed === '' || HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`;
  },
  validate: value => (isNil(parseUrl(value)) ? invalid('url-format') : VALID),
});
