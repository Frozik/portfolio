import { isNil } from 'lodash-es';
import { z } from 'zod';

import sharedCredentials from '../data/apple-password-manager-resources/shared-credentials.json';

const ENTRIES_SCHEMA = z.array(
  z.union([
    z.object({ shared: z.array(z.string()) }),
    z.object({
      from: z.array(z.string()),
      to: z.array(z.string()),
      fromDomainsAreObsoleted: z.boolean().optional(),
    }),
  ])
);

interface ISharedCredentialIndex {
  /** Page domain → domains whose logins may be offered there. */
  readonly offeredOn: ReadonlyMap<string, ReadonlySet<string>>;
  /** Domain that moved → where it went. */
  readonly movedTo: ReadonlyMap<string, readonly string[]>;
}

function offer(
  index: Map<string, Set<string>>,
  pageDomain: string,
  credentialDomains: readonly string[]
): void {
  const offered = index.get(pageDomain) ?? new Set<string>();
  credentialDomains.filter(domain => domain !== pageDomain).forEach(domain => offered.add(domain));
  index.set(pageDomain, offered);
}

function buildIndex(): ISharedCredentialIndex {
  const offeredOn = new Map<string, Set<string>>();
  const movedTo = new Map<string, readonly string[]>();
  for (const entry of ENTRIES_SCHEMA.parse(sharedCredentials)) {
    if ('shared' in entry) {
      entry.shared.forEach(domain => offer(offeredOn, domain, entry.shared));
      continue;
    }
    entry.to.forEach(domain => offer(offeredOn, domain, entry.from));
    if (entry.fromDomainsAreObsoleted === true) {
      entry.from.forEach(domain => movedTo.set(domain, entry.to));
    }
  }
  return { offeredOn, movedTo };
}

let index: ISharedCredentialIndex | null = null;

function sharedIndex(): ISharedCredentialIndex {
  index ??= buildIndex();
  return index;
}

/**
 * Apple's shared logins: `{ shared }` groups work both ways,
 * `{ from, to }` offers the logins of the old domains on the new ones only.
 */
export function domainsSharingLoginWith(pageDomain: string): ReadonlySet<string> {
  return sharedIndex().offeredOn.get(pageDomain) ?? new Set();
}

/** "the site moved": where a domain marked obsolete went. */
export function successorsOf(domain: string): readonly string[] {
  const successors = sharedIndex().movedTo.get(domain);
  return isNil(successors) ? [] : successors;
}
