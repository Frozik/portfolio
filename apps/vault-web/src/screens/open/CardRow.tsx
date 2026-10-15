import { cn } from '@frozik/components/components/cn';
import type { TVaultKey } from '@frozik/vault/persistence/ports';
import { isNil } from 'lodash-es';
import { Lock, Star } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { Link } from 'react-router-dom';

import type { ICardRow } from '@frozik/vault-app/document/application/card-row';
import type { TVaultSection } from '@frozik/vault-app/navigation/vault-pages';
import { SiteCardIcon } from '@frozik/vault-react/card-icon/SiteCardIcon';
import { LANGUAGE } from '@frozik/vault-react/texts/language';
import { vaultT } from '@frozik/vault-react/texts/vault';
import { paths } from '../paths';

const ICON_SIZE = 14;

/** One card of the list: the icon, title and marks, and the login or a masked number — never a secret. */
export const CardRow = observer(
  ({
    vaultKey,
    section,
    row,
    siteIcon,
    selected,
  }: {
    readonly vaultKey: TVaultKey;
    readonly section: TVaultSection;
    readonly row: ICardRow;
    readonly siteIcon: Uint8Array<ArrayBuffer> | null;
    /** The card open beside the list on a wide screen. */
    readonly selected: boolean;
  }) => {
    const t = vaultT.list;
    const { card } = row;
    return (
      <Link
        to={paths.card(vaultKey, section, card.id)}
        data-testid="card-row"
        aria-current={selected ? 'page' : undefined}
        className={cn(
          'flex h-16 items-center gap-3 border-b border-line-soft px-4 text-fg no-underline',
          selected && 'bg-bg-card'
        )}
      >
        <SiteCardIcon card={card} siteIcon={siteIcon} locale={LANGUAGE} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2 text-[15px] font-medium">
            <span className="truncate">{card.title === '' ? t.untitled : card.title}</span>
            {card.favorite && <Star size={ICON_SIZE} aria-label={t.badges.favorite} />}
            {card.protected && <Lock size={ICON_SIZE} aria-label={t.badges.protected} />}
          </span>
          <span className="flex items-center gap-2 text-[13px] text-fg-faint">
            {!isNil(row.subtitle) && <span className="truncate">{row.subtitle}</span>}
            {!isNil(row.expiry) && (
              <span className={row.expiry === 'expired' ? 'text-danger' : 'text-caution'}>
                {t.badges[row.expiry]}
              </span>
            )}
            {row.hasOneTimeCode && <span>{t.badges.otp}</span>}
          </span>
        </span>
      </Link>
    );
  }
);
