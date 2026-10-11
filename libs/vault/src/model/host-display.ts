import { isNil } from 'lodash-es';
import { toUnicode } from 'punycode.js';

import { parseUrl } from './parse-url';

const PUNYCODE_LABEL = /(^|\.)xn--/;

export interface IHostDisplay {
  readonly unicode: string;
  /** The ASCII form, shown next to a host with non-ASCII characters so a lookalike cannot hide. */
  readonly punycode: string | null;
}

export function describeHost(url: string): IHostDisplay | null {
  const parsed = parseUrl(url);
  if (isNil(parsed) || parsed.hostname === '') {
    return null;
  }
  const ascii = parsed.hostname;
  return PUNYCODE_LABEL.test(ascii)
    ? { unicode: toUnicode(ascii), punycode: ascii }
    : { unicode: ascii, punycode: null };
}
