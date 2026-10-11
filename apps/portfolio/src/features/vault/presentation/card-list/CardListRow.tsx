import { cn } from '@frozik/components/components/cn';
import type { IVaultCard } from '@frozik/vault/model/card';
import { allFields } from '@frozik/vault/model/card';
import { cardSubtitle } from '@frozik/vault/model/card-subtitle';
import type { TExpiryStatus } from '@frozik/vault/model/expiry';
import { Lock, Star } from 'lucide-react';
import { observer } from 'mobx-react-lite';

import { CHANGED_MARK_CLASS } from '../components/changed-mark';
import { SiteCardIcon } from '../components/SiteCardIcon';
import { vaultT } from '../translations';

const ICON_SIZE = 14;

/** One row: title, the masked subtitle, expiry and one-time-code badges, favourite and lock marks. */
export const CardListRow = observer(
  ({
    id,
    card,
    expiry,
    siteIcon,
    selected,
    modified,
    active,
    top,
    height,
    onOpen,
  }: {
    readonly id: string;
    readonly card: IVaultCard;
    readonly expiry: TExpiryStatus;
    readonly siteIcon: Uint8Array<ArrayBuffer> | null;
    readonly selected: boolean;
    readonly modified: boolean;
    readonly active: boolean;
    readonly top: number;
    readonly height: number;
    readonly onOpen: (card: IVaultCard) => void;
  }) => {
    const t = vaultT.list;
    const subtitle = cardSubtitle(card);
    const hasOtp = allFields(card).some(field => field.spec.kind === 'otp');
    return (
      <div
        id={id}
        role="option"
        aria-selected={selected}
        tabIndex={-1}
        className={cn(
          'absolute inset-x-0 flex cursor-pointer items-center gap-3 border-b border-landing-border-soft px-4',
          selected && 'bg-landing-bg-card',
          modified && CHANGED_MARK_CLASS,
          active && 'outline outline-2 -outline-offset-2 outline-brand-500'
        )}
        style={{ top, height }}
        onClick={() => onOpen(card)}
      >
        <SiteCardIcon card={card} siteIcon={siteIcon} />
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex items-center gap-2 text-[14px] font-medium text-landing-fg">
            <span className="truncate">{card.title === '' ? t.untitled : card.title}</span>
            {card.favorite && <Star size={ICON_SIZE} aria-label={t.badges.favorite} />}
            {card.protected && <Lock size={ICON_SIZE} aria-label={t.badges.protected} />}
          </span>
          <span className="flex items-center gap-2 text-[12px] text-landing-fg-faint">
            {subtitle !== null && <span className="truncate">{subtitle}</span>}
            {(expiry === 'soon' || expiry === 'expired') && (
              <span className={expiry === 'expired' ? 'text-error' : 'text-warning'}>
                {t.badges[expiry]}
              </span>
            )}
            {hasOtp && <span>{t.badges.otp}</span>}
            {modified && <span className="text-warning">{t.badges.unsaved}</span>}
          </span>
        </span>
      </div>
    );
  }
);
