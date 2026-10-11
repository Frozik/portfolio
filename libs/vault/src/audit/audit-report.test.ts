import { Temporal } from 'temporal-polyfill';

import type { IVaultCard } from '../model/card';
import { MAX_CARD_HISTORY } from '../model/card';
import { aCardWith, aField, aDocument, anHlc } from '../testing/builders';
import type { IAuditInputs, TAuditCategory } from './audit-report';
import { auditVault } from './audit-report';
import { twoFactorDomainsOf } from './two-factor-directory';

const NOW = Temporal.Instant.from('2026-10-11T12:00:00Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const URL_SPEC = { kind: 'url', match: 'host', useSharedCredentials: true } as const;

const KNOWN: IAuditInputs = {
  now: NOW,
  today: Temporal.PlainDate.from('2026-10-11'),
  strength: password => (password.length < 10 ? 1 : 4),
  breaches: password => (password === 'leaked-but-long-enough' ? 12 : 0),
  twoFactorDomains: twoFactorDomainsOf([
    ['GitHub', { domain: 'github.com', tfa: ['totp'] }],
    ['Google', { domain: 'google.com', 'additional-domains': ['youtube.com'] }],
    ['broken entry'],
  ]),
};

function account(
  url: string,
  password: string,
  details: { readonly otp?: boolean; readonly excluded?: boolean } = {}
): IVaultCard {
  const at = anHlc(NOW.epochMilliseconds - DAY_MS);
  return aCardWith(
    [
      aField(URL_SPEC, [url]),
      aField({ kind: 'password', rotateEveryDays: null }, password, {
        excludeFromAudit: details.excluded === true,
      }),
      ...(details.otp === true
        ? [aField({ kind: 'otp' }, 'otpauth://totp/x?secret=JBSWY3DP')]
        : []),
    ],
    { title: url, createdAt: at, updatedAt: at }
  );
}

function categoriesOf(cards: readonly IVaultCard[], inputs = KNOWN) {
  const report = auditVault(aDocument(cards), inputs);
  return (card: IVaultCard): readonly TAuditCategory[] => report.byCard.get(card.id) ?? [];
}

describe('the audit', () => {
  it('finds weak and leaked passwords from what the estimates and the breach check say', () => {
    const weak = account('https://a.example', 'short');
    const leaked = account('https://b.example', 'leaked-but-long-enough');
    const of = categoriesOf([weak, leaked]);

    expect(of(weak)).toEqual(['weak']);
    expect(of(leaked)).toEqual(['leaked']);
  });

  it('calls a password reused on two sites, not on two domains of one site (Envato’s)', () => {
    const github = account('https://github.com', 'same-long-password');
    const gitlab = account('https://gitlab.com', 'same-long-password');
    const envato = account('https://envato.com', 'envato-long-password');
    const themeforest = account('https://themeforest.net', 'envato-long-password');
    const of = categoriesOf([github, gitlab, envato, themeforest]);

    expect(of(github)).toContain('reused');
    expect(of(gitlab)).toContain('reused');
    expect(of(envato)).not.toContain('reused');
    expect(of(themeforest)).not.toContain('reused');
  });

  it('flags a plain-HTTP address and a site that offers one-time codes the card does not have', () => {
    const insecure = account('http://router.example', 'a-long-password-1');
    const noOtp = account('https://www.github.com/login', 'a-long-password-2');
    const withOtp = account('https://github.com', 'a-long-password-3', { otp: true });
    const youtube = account('https://youtube.com', 'a-long-password-4');
    const of = categoriesOf([insecure, noOtp, withOtp, youtube]);

    expect(of(insecure)).toEqual(['insecure-url']);
    expect(of(noOtp)).toEqual(['no-2fa']);
    expect(of(withOtp)).toEqual([]);
    expect(of(youtube)).toEqual(['no-2fa']);
  });

  it('calls a password old after a year without a change, by its history', () => {
    const yearAndADay = anHlc(NOW.epochMilliseconds - 366 * DAY_MS);
    const old = account('https://a.example', 'a-long-password-1');
    const changed = account('https://b.example', 'a-long-password-2');
    const oldCard: IVaultCard = { ...old, createdAt: yearAndADay };
    const changedCard: IVaultCard = {
      ...changed,
      createdAt: yearAndADay,
      history: [
        { at: yearAndADay, snapshot: { ...changed, tabs: [{ ...changed.tabs[0], fields: [] }] } },
      ],
    };
    const of = categoriesOf([oldCard, changedCard]);

    expect(of(oldCard)).toEqual(['old']);
    expect(of(changedCard)).toEqual([]);
  });

  it('skips fields excluded from the audit, and the archive and the trash', () => {
    const excluded = account('https://a.example', 'short', { excluded: true });
    const archived = { ...account('https://b.example', 'short'), archivedAt: anHlc(1) };
    const of = categoriesOf([excluded, archived]);

    expect(of(excluded)).toEqual([]);
    expect(of(archived)).toEqual([]);
  });

  it('finds nothing in what is not known yet', () => {
    const card = account('https://github.com', 'short');
    const of = categoriesOf([card], {
      ...KNOWN,
      strength: () => null,
      breaches: () => null,
      twoFactorDomains: null,
    });

    expect(of(card)).toEqual([]);
  });

  it('does not call a password old when its change may have fallen off a full history', () => {
    const longAgo = anHlc(NOW.epochMilliseconds - 3 * 365 * DAY_MS);
    const card = account('https://a.example', 'a-long-password-1');
    const recentEdits = Array.from({ length: MAX_CARD_HISTORY }, (_, index) => ({
      at: anHlc(NOW.epochMilliseconds - (index + 1) * DAY_MS),
      snapshot: card,
    }));
    const of = categoriesOf([{ ...card, createdAt: longAgo, history: recentEdits }]);

    expect(of({ ...card, createdAt: longAgo, history: recentEdits })).toEqual([]);
  });

  it('calls a password old after the period its field sets, sooner than a year', () => {
    const quarterAndADay = anHlc(NOW.epochMilliseconds - 91 * DAY_MS);
    const withPeriod = (url: string, rotateEveryDays: number | null): IVaultCard => {
      const base = account(url, `a-long-password-for-${url}`);
      return {
        ...base,
        createdAt: quarterAndADay,
        updatedAt: quarterAndADay,
        tabs: [
          {
            ...base.tabs[0],
            fields: base.tabs[0].fields.map(field =>
              field.spec.kind === 'password'
                ? { ...field, spec: { kind: 'password', rotateEveryDays } }
                : field
            ),
          },
        ],
      };
    };
    const quarterly = withPeriod('https://a.example', 90);
    const yearly = withPeriod('https://b.example', null);
    const of = categoriesOf([quarterly, yearly]);

    expect(of(quarterly)).toEqual(['old']);
    expect(of(yearly)).toEqual([]);
  });
});
