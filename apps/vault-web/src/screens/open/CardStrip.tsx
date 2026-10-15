import type { IVaultCard } from '@frozik/vault/model/card';
import type { TVaultKey } from '@frozik/vault/persistence/ports';
import { observer } from 'mobx-react-lite';
import { Link } from 'react-router-dom';

import type { VaultView } from '@frozik/vault-app/document/application/VaultView';
import type { TVaultSection } from '@frozik/vault-app/navigation/vault-pages';
import { SiteCardIcon } from '@frozik/vault-react/card-icon/SiteCardIcon';
import { LANGUAGE } from '@frozik/vault-react/texts/language';
import { vaultT } from '@frozik/vault-react/texts/vault';
import { paths } from '../paths';

/** A row of cards one tap away above the list: the favourites, or those opened lately on this device. */
export const CardStrip = observer(
  ({
    vaultKey,
    view,
    title,
    cards,
    section,
    testId,
  }: {
    readonly vaultKey: TVaultKey;
    readonly view: VaultView;
    readonly title: string;
    readonly cards: readonly IVaultCard[];
    /** The section a card opens in, so "back" returns to it. */
    readonly section: TVaultSection;
    readonly testId: string;
  }) => {
    if (cards.length === 0) {
      return null;
    }
    return (
      <section aria-label={title} className="flex flex-col gap-2 px-4">
        <h2 className="text-[13px] text-fg-faint">{title}</h2>
        <ul className="flex gap-3 overflow-x-auto pb-1" data-testid={testId}>
          {cards.map(card => (
            <li key={card.id} className="shrink-0">
              <Link
                to={paths.card(vaultKey, section, card.id)}
                className="flex w-20 flex-col items-center gap-1 text-center text-[12px] text-fg no-underline"
              >
                <SiteCardIcon card={card} siteIcon={view.siteIconOf(card)} locale={LANGUAGE} />
                <span className="line-clamp-2 w-full break-words">
                  {card.title === '' ? vaultT.list.untitled : card.title}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  }
);
