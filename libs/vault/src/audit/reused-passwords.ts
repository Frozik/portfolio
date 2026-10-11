import { isNil, minBy } from 'lodash-es';

import type { IVaultCard } from '../model/card';
import { loginHostOf, registrableDomainOf } from '../model/domains';
import type { TCardId } from '../model/ids';
import { domainsSharingLoginWith } from '../model/shared-credentials';
import { auditedValuesOf, passwordsOf } from './audited-passwords';

const SITES = new WeakMap<IVaultCard, string>();

/** The site a card signs in to, as one name for every domain that shares its logins. */
function loginSiteOf(card: IVaultCard): string {
  const known = SITES.get(card);
  if (!isNil(known)) {
    return known;
  }
  const site = siteOf(card);
  SITES.set(card, site);
  return site;
}

function siteOf(card: IVaultCard): string {
  const host = auditedValuesOf(card, 'url')
    .map(loginHostOf)
    .find(found => !isNil(found));
  if (isNil(host)) {
    return `card:${card.id}`;
  }
  const domain = registrableDomainOf(host) ?? host;
  return minBy([domain, ...domainsSharingLoginWith(domain)], name => name) ?? domain;
}

/**
 * The same password on two sites. One site with several
 * domains sharing its logins (apple.com and icloud.com) is not a reuse.
 */
export function reusedPasswordCards(cards: readonly IVaultCard[]): ReadonlySet<TCardId> {
  const sitesByPassword = new Map<string, Map<string, TCardId[]>>();
  for (const card of cards) {
    const site = loginSiteOf(card);
    for (const password of new Set(passwordsOf(card))) {
      const sites = sitesByPassword.get(password) ?? new Map<string, TCardId[]>();
      sites.set(site, [...(sites.get(site) ?? []), card.id]);
      sitesByPassword.set(password, sites);
    }
  }
  const reused = new Set<TCardId>();
  for (const sites of sitesByPassword.values()) {
    if (sites.size > 1) {
      [...sites.values()].flat().forEach(cardId => reused.add(cardId));
    }
  }
  return reused;
}
