import { assertNever } from '@frozik/utils/assert/assertNever';
import { isNil } from 'lodash-es';

import type { TFieldSpec } from './card';
import { loginHostOf, registrableDomainOf } from './domains';
import { parseUrl } from './parse-url';
import { domainsSharingLoginWith } from './shared-credentials';

type TUrlSpec = Extract<TFieldSpec, { readonly kind: 'url' }>;

/** How a stored address matched the page: directly, or through a shared login (shown with a note). */
export type TUrlMatchResult = 'direct' | 'shared' | null;

const MAX_REGEX_LENGTH = 256;

function originAndPath(url: string): string | null {
  const parsed = parseUrl(url);
  return isNil(parsed) ? null : parsed.origin + parsed.pathname;
}

function matchesRegex(pattern: string, page: string): boolean {
  if (pattern.length > MAX_REGEX_LENGTH) {
    return false;
  }
  try {
    return new RegExp(pattern, 'u').test(page);
  } catch {
    return false;
  }
}

function matchesDirectly(stored: string, match: TUrlSpec['match'], pageUrl: string): boolean {
  switch (match) {
    case 'host': {
      const host = loginHostOf(stored);
      return !isNil(host) && host === loginHostOf(pageUrl);
    }
    case 'base-domain': {
      const host = loginHostOf(stored);
      const pageHost = loginHostOf(pageUrl);
      const domain = isNil(host) ? null : registrableDomainOf(host);
      return !isNil(domain) && !isNil(pageHost) && domain === registrableDomainOf(pageHost);
    }
    case 'exact': {
      const target = originAndPath(stored);
      return !isNil(target) && target === originAndPath(pageUrl);
    }
    case 'starts-with': {
      const prefix = originAndPath(stored);
      const page = originAndPath(pageUrl);
      return !isNil(prefix) && !isNil(page) && page.startsWith(prefix);
    }
    case 'regex': {
      const page = originAndPath(pageUrl);
      return !isNil(page) && matchesRegex(stored, page);
    }
    case 'never':
      return false;
    default:
      return assertNever(match);
  }
}

function matchesShared(stored: string, pageUrl: string): boolean {
  const host = loginHostOf(stored);
  const pageHost = loginHostOf(pageUrl);
  const domain = isNil(host) ? null : registrableDomainOf(host);
  const pageDomain = isNil(pageHost) ? null : registrableDomainOf(pageHost);
  return !isNil(domain) && !isNil(pageDomain) && domainsSharingLoginWith(pageDomain).has(domain);
}

/**
 * One function for search, audit and the extension. `host`
 * is the default: matching on the registrable domain would hand the password
 * of `accounts.example.com` to any XSS on any other subdomain.
 */
export function matchUrl(stored: string, spec: TUrlSpec, pageUrl: string): TUrlMatchResult {
  if (matchesDirectly(stored, spec.match, pageUrl)) {
    return 'direct';
  }
  const sharable =
    spec.useSharedCredentials && (spec.match === 'host' || spec.match === 'base-domain');
  return sharable && matchesShared(stored, pageUrl) ? 'shared' : null;
}
