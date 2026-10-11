import { isNil } from 'lodash-es';

import type { ICardState } from './card';
import { allFields, fieldValues } from './card';
import { loginHostOf, registrableDomainOf } from './domains';
import type { TSiteIcon } from './site-icon';
import type { IVaultDocument } from './vault-document';

/** A site found without an icon is not asked again for this long. */
export const SITE_ICON_RETRY_MS = 30 * 24 * 60 * 60 * 1000;
/** What a domain must look like to name a file in the container. */
export const ICON_DOMAIN = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/;

function emailDomainOf(value: string): string | null {
  const at = value.lastIndexOf('@');
  return at < 0 ? null : value.slice(at + 1).toLowerCase();
}

/** Whose icon a card shows: its first address's site, else its first email's domain. */
export function iconDomainOf(card: ICardState): string | null {
  const fields = allFields(card);
  for (const field of fields) {
    const [first] = field.spec.kind === 'url' ? fieldValues(field) : [];
    const host = isNil(first) ? null : loginHostOf(first);
    if (!isNil(host)) {
      return registrableDomainOf(host) ?? host;
    }
  }
  for (const field of fields) {
    const [first] = field.spec.kind === 'email' ? fieldValues(field) : [];
    const domain = isNil(first) ? null : emailDomainOf(first);
    if (!isNil(domain)) {
      return domain;
    }
  }
  return null;
}

/** The domains whose icon the vault still lacks: of live cards showing the automatic icon, a "none" once its wait is over. */
export function siteIconsWanted(document: IVaultDocument, nowMs: number): readonly string[] {
  const wanted = new Set<string>();
  for (const card of document.cards.values()) {
    if (card.icon.kind !== 'auto' || !isNil(card.trashedAt)) {
      continue;
    }
    const domain = iconDomainOf(card);
    if (isNil(domain) || !ICON_DOMAIN.test(domain)) {
      continue;
    }
    const known = document.siteIcons.get(domain);
    if (isNil(known) || (known.kind === 'none' && nowMs - known.at.wallMs >= SITE_ICON_RETRY_MS)) {
      wanted.add(domain);
    }
  }
  return [...wanted];
}

export function setSiteIcon(
  document: IVaultDocument,
  domain: string,
  icon: TSiteIcon
): IVaultDocument {
  return { ...document, siteIcons: new Map(document.siteIcons).set(domain, icon) };
}
