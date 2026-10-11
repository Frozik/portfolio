import { isNil } from 'lodash-es';
import { z } from 'zod';

import changePasswordUrls from '../data/apple-password-manager-resources/change-password-urls.json';
import type { ICardState } from './card';
import { allFields } from './card';
import { loginHostOf, registrableDomainOf } from './domains';

const URLS_SCHEMA = z.record(z.string(), z.string());

let urls: Readonly<Record<string, string>> | null = null;

/**
 * Where to change the password of a login: Apple's list by
 * host or registrable domain, else the W3C `/.well-known/change-password`.
 * Only a link to open; the app itself requests nothing.
 */
export function changePasswordUrlOf(storedUrl: string): string | null {
  const host = loginHostOf(storedUrl);
  if (isNil(host)) {
    return null;
  }
  urls ??= URLS_SCHEMA.parse(changePasswordUrls);
  const domain = registrableDomainOf(host);
  return (
    urls[host] ??
    (isNil(domain) ? undefined : urls[domain]) ??
    `https://${host}/.well-known/change-password`
  );
}

/** The page that changes the password of the card's first site, if it has one. */
export function changePasswordUrlOfCard(card: ICardState): string | null {
  const site = allFields(card).find(field => field.spec.kind === 'url');
  const [first] = isNil(site)
    ? []
    : site.value.cardinality === 'single'
      ? [site.value.value]
      : site.value.values;
  return isNil(first) || first === '' ? null : changePasswordUrlOf(first);
}
