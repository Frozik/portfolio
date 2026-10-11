import { isNil } from 'lodash-es';
import { getDomain } from 'tldts';

import { parseUrl } from './parse-url';

const WWW = 'www.';
const WEB_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:']);

/** The host a login belongs to: lower case, without the port and without a leading `www.`. */
export function loginHostOf(url: string): string | null {
  const parsed = parseUrl(url);
  if (isNil(parsed) || !WEB_PROTOCOLS.has(parsed.protocol) || parsed.hostname === '') {
    return null;
  }
  return parsed.hostname.startsWith(WWW) ? parsed.hostname.slice(WWW.length) : parsed.hostname;
}

/**
 * The registrable domain, private suffixes included: `user.github.io` is its
 * own site, not a subdomain of `github.io` (the Public Suffix List, via tldts).
 */
export function registrableDomainOf(host: string): string | null {
  return getDomain(host, { allowPrivateDomains: true });
}
