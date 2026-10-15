import { Checkbox } from '@frozik/components/components/RichEditor/Checkbox';
import { AUDIT_CATEGORIES } from '@frozik/vault/audit/audit-report';
import type { TAuditCategory } from '@frozik/vault/audit/audit-report';
import type { IVaultCard } from '@frozik/vault/model/card';
import { changePasswordUrlOfCard } from '@frozik/vault/model/change-password-url';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { NavLink } from 'react-router-dom';

import { CardFrame } from '@frozik/components/ui/CardFrame';
import type { TVaultPaths } from '@frozik/vault-app/navigation/vault-paths';
import type { VaultSession } from '@frozik/vault-app/session/application/VaultSession';
import { auditT } from '../texts/audit';
import { vaultT } from '../texts/vault';

/** Categories where a new password is the fix: their cards get a link to the site's change page. */
const PASSWORD_PROBLEMS: ReadonlySet<TAuditCategory> = new Set(['leaked', 'weak', 'reused', 'old']);

const CategoryCards = observer(
  ({
    session,
    paths,
    category,
    cards,
  }: {
    readonly session: VaultSession;
    readonly paths: TVaultPaths;
    readonly category: TAuditCategory;
    readonly cards: readonly IVaultCard[];
  }) => {
    const t = auditT;
    return (
      <CardFrame className="flex flex-col gap-3 p-5">
        <h3 className="text-[15px] font-medium text-landing-fg">
          {t.categories[category]} · {cards.length}
        </h3>
        <ul className="flex flex-col gap-2">
          {cards.map(card => {
            const changeAt = PASSWORD_PROBLEMS.has(category) ? changePasswordUrlOfCard(card) : null;
            return (
              <li key={card.id} className="flex flex-wrap items-center gap-3 text-[13px]">
                <NavLink
                  to={paths.card(session.vaultKey, 'problems', card.id)}
                  className="text-landing-fg underline"
                >
                  {card.title || vaultT.list.untitled}
                </NavLink>
                {!isNil(changeAt) && (
                  <a
                    href={changeAt}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-landing-fg-dim underline"
                  >
                    {t.changePassword}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      </CardFrame>
    );
  }
);

/**
 * The dashboard: one block per category with its cards (the
 * archive and the trash are left out), the opt-in breach check and the 2FA
 * Directory credit.
 */
export const AuditPage = observer(
  ({ session, paths }: { readonly session: VaultSession; readonly paths: TVaultPaths }) => {
    const t = auditT;
    const { report, twoFactorDomains, directoryLoaded } = session.audit;
    const { checkLeaks } = session.deviceSettings.settings;
    const found = AUDIT_CATEGORIES.flatMap(category => {
      const cards = report.byCategory.get(category) ?? [];
      return cards.length === 0 ? [] : [{ category, cards }];
    });
    return (
      <section className="flex max-w-[720px] flex-col gap-5">
        <NavLink
          to={paths.vault(session.vaultKey)}
          className="text-[13px] text-landing-fg-dim underline"
        >
          {t.back}
        </NavLink>
        <h2 className="text-[22px] font-medium text-landing-fg">{t.title}</h2>
        <p className="text-[13px] text-landing-fg-dim">{t.intro}</p>
        <div className="flex flex-col gap-1.5">
          <Checkbox
            checked={checkLeaks}
            onCheckedChange={value => session.deviceSettings.update({ checkLeaks: value })}
          >
            {t.checkLeaks}
          </Checkbox>
          <span className="text-[12px] text-landing-fg-faint">{t.checkLeaksNote}</span>
        </div>
        {found.length === 0 ? (
          <p className="text-[14px] text-landing-fg">{t.clean}</p>
        ) : (
          found.map(({ category, cards }) => (
            <CategoryCards
              key={category}
              session={session}
              paths={paths}
              category={category}
              cards={cards}
            />
          ))
        )}
        {directoryLoaded && (
          <span
            className="text-[12px] text-landing-fg-faint"
            data-testid="two-factor-directory"
            data-state={isNil(twoFactorDomains) ? 'missing' : 'loaded'}
          >
            {isNil(twoFactorDomains) ? t.directoryMissing : t.twoFactorCredit}
          </span>
        )}
      </section>
    );
  }
);
