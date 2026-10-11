import { isNil } from 'lodash-es';
import type { Temporal } from 'temporal-polyfill';

import type { IVaultCard } from '../model/card';
import { allFields } from '../model/card';
import { loginHostOf, registrableDomainOf } from '../model/domains';
import { expiryStatus, warningDaysFor } from '../model/expiry';
import type { TCardId } from '../model/ids';
import {
  MS_PER_DAY,
  OLD_PASSWORD_DAYS,
  passwordSetAtMs,
  rotationPeriodDays,
} from '../model/password-age';
import type { IVaultDocument } from '../model/vault-document';
import { auditedCards, auditedValuesOf, passwordsOf } from './audited-passwords';
import { reusedPasswordCards } from './reused-passwords';

/** The categories of the dashboard, as 1Password's Watchtower has them. */
export const AUDIT_CATEGORIES = [
  'leaked',
  'weak',
  'reused',
  'insecure-url',
  'no-2fa',
  'old',
  'expired',
  'expiring',
] as const;

export type TAuditCategory = (typeof AUDIT_CATEGORIES)[number];

const INSECURE_SCHEME = 'http://';

/** zxcvbn's 0–4: a password scoring this or lower is weak. */
export const WEAK_SCORE = 2;

/** What the audit knows beyond the document; each part may still be on its way. */
export interface IAuditInputs {
  readonly now: Temporal.Instant;
  readonly today: Temporal.PlainDate;
  /** zxcvbn's score of a password, `null` until estimated. */
  readonly strength: (password: string) => number | null;
  /** Times a password appears in Have I Been Pwned, `null` when not checked (the check is opt-in). */
  readonly breaches: (password: string) => number | null;
  /** Sites that offer one-time codes, `null` until the directory is loaded. */
  readonly twoFactorDomains: ReadonlySet<string> | null;
}

export interface IAuditReport {
  readonly byCard: ReadonlyMap<TCardId, readonly TAuditCategory[]>;
  readonly byCategory: ReadonlyMap<TAuditCategory, readonly IVaultCard[]>;
}

/** What a card says for itself, apart from what the audit learns: computed once per card version. */
interface ICardFacts {
  readonly passwords: readonly string[];
  readonly urls: readonly string[];
  readonly hasOtp: boolean;
  readonly passwordSetAtMs: number;
  /** A year, or the shorter period a password field sets. */
  readonly oldAfterDays: number;
}

const FACTS = new WeakMap<IVaultCard, ICardFacts>();

function factsOf(card: IVaultCard): ICardFacts {
  const known = FACTS.get(card);
  if (!isNil(known)) {
    return known;
  }
  const facts = {
    passwords: passwordsOf(card),
    urls: auditedValuesOf(card, 'url'),
    hasOtp: allFields(card).some(field => field.spec.kind === 'otp'),
    passwordSetAtMs: passwordSetAtMs(card, passwordsOf),
    oldAfterDays: rotationPeriodDays(card) ?? OLD_PASSWORD_DAYS,
  };
  FACTS.set(card, facts);
  return facts;
}

function offersTwoFactor(urls: readonly string[], domains: ReadonlySet<string>): boolean {
  return urls.some(url => {
    const host = loginHostOf(url);
    return !isNil(host) && domains.has(registrableDomainOf(host) ?? host);
  });
}

function categoriesOf(
  card: IVaultCard,
  document: IVaultDocument,
  inputs: IAuditInputs,
  reused: ReadonlySet<TCardId>
): readonly TAuditCategory[] {
  const { passwords, urls, hasOtp } = factsOf(card);
  const expiry = expiryStatus(card, inputs.today, warningDaysFor(card, document.settings));
  const checks: Readonly<Record<TAuditCategory, () => boolean>> = {
    leaked: () => passwords.some(password => (inputs.breaches(password) ?? 0) > 0),
    weak: () =>
      passwords.some(password => {
        const score = inputs.strength(password);
        return !isNil(score) && score <= WEAK_SCORE;
      }),
    reused: () => reused.has(card.id),
    'insecure-url': () => urls.some(url => url.toLowerCase().startsWith(INSECURE_SCHEME)),
    'no-2fa': () =>
      !isNil(inputs.twoFactorDomains) &&
      passwords.length > 0 &&
      !hasOtp &&
      offersTwoFactor(urls, inputs.twoFactorDomains),
    old: () =>
      passwords.length > 0 &&
      inputs.now.epochMilliseconds - factsOf(card).passwordSetAtMs >
        factsOf(card).oldAfterDays * MS_PER_DAY,
    expired: () => expiry === 'expired',
    expiring: () => expiry === 'soon',
  };
  return AUDIT_CATEGORIES.filter(category => checks[category]());
}

/**
 * Every card outside the archive and the trash against
 * every check, in one pass; fields the user excluded do not count. What is
 * not known yet (strength, breaches, the directory) finds nothing for now.
 */
export function auditVault(document: IVaultDocument, inputs: IAuditInputs): IAuditReport {
  const cards = auditedCards(document);
  const reused = reusedPasswordCards(cards);
  const byCard = new Map<TCardId, readonly TAuditCategory[]>();
  const byCategory = new Map<TAuditCategory, IVaultCard[]>();
  for (const card of cards) {
    const categories = categoriesOf(card, document, inputs, reused);
    if (categories.length === 0) {
      continue;
    }
    byCard.set(card.id, categories);
    for (const category of categories) {
      const members = byCategory.get(category);
      if (isNil(members)) {
        byCategory.set(category, [card]);
      } else {
        members.push(card);
      }
    }
  }
  return { byCard, byCategory };
}
