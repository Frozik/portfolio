import { z } from 'zod';

const ENTRY_SCHEMA = z.tuple([
  z.string(),
  z.looseObject({
    domain: z.string(),
    'additional-domains': z.array(z.string()).optional(),
  }),
]);

/**
 * 2FA Directory's `v4/totp.json` (MIT, "Data sourced from
 * 2FA Directory by 2factorauth"): the sites that offer one-time codes, by
 * domain. An entry it cannot read is skipped, not the whole list.
 */
export function twoFactorDomainsOf(json: unknown): ReadonlySet<string> {
  const entries = z.array(z.unknown()).safeParse(json);
  const domains = new Set<string>();
  for (const entry of entries.success ? entries.data : []) {
    const parsed = ENTRY_SCHEMA.safeParse(entry);
    if (!parsed.success) {
      continue;
    }
    const [, site] = parsed.data;
    [site.domain, ...(site['additional-domains'] ?? [])].forEach(domain =>
      domains.add(domain.toLowerCase())
    );
  }
  return domains;
}
