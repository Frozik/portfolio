import { Tabs } from '@frozik/components/components/RichEditor/Tabs';
import type { IVaultCard } from '@frozik/vault/model/card';
import { changePasswordUrlOfCard } from '@frozik/vault/model/change-password-url';
import type { TCardId, TTabId } from '@frozik/vault/model/ids';
import { BANK_CARD_TEMPLATE } from '@frozik/vault/model/templates/bank-card';
import { isNil } from 'lodash-es';
import { Lock, Star } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { NavLink } from 'react-router-dom';

import { Alert } from '@frozik/components/ui/Alert';
import { Button } from '@frozik/components/ui/Button';
import { pageLanguage } from '@frozik/utils/i18n/page-language';
import type { VaultSession } from '@frozik/vault-app/session/application/VaultSession';
import { SiteCardIcon } from '@frozik/vault-react/card-icon/SiteCardIcon';
import { CardMenu } from '@frozik/vault-react/card/CardMenu';
import { ConcurrentVersions } from '@frozik/vault-react/card/ConcurrentVersions';
import { ExpiryBanner } from '@frozik/vault-react/card/ExpiryBanner';
import { LinkedCards } from '@frozik/vault-react/card/LinkedCards';
import { PhysicalCard } from '@frozik/vault-react/card/PhysicalCard';
import { RotationBanner } from '@frozik/vault-react/card/RotationBanner';
import { tabLabelOf } from '@frozik/vault-react/editor/tab-label';
import { ProtectedGateDialog } from '@frozik/vault-react/protected/ProtectedGateDialog';
import { editorT } from '@frozik/vault-react/texts/editor';
import { vaultT } from '@frozik/vault-react/texts/vault';
import { FieldRow } from './FieldRow';

const ICON_SIZE = 16;

/** A card as read: title and marks, the tab bar from the second tab on, the fields. */
export const CardView = observer(
  ({
    card,
    session,
    onDuplicated,
    onPurged,
    onOpenCard,
    historyPath,
  }: {
    readonly card: IVaultCard;
    readonly session: VaultSession;
    readonly onDuplicated: (cardId: TCardId) => void;
    readonly onPurged: () => void;
    readonly onOpenCard: (cardId: TCardId) => void;
    readonly historyPath: string;
  }) => {
    const t = vaultT.card;
    const [openingGate, setOpeningGate] = useState(false);
    const [firstTab] = card.tabs;
    const [tabId, setTabId] = useState<TTabId>(firstTab.id);
    const locked = card.protected && !session.protectedGate.isOpen;
    const changePasswordUrl = changePasswordUrlOfCard(card);

    const fieldsOf = (tab: IVaultCard['tabs'][number]) => (
      <div className="flex flex-col">
        {tab.fields.map(field => (
          <FieldRow key={field.id} field={field} session={session} locked={locked} />
        ))}
      </div>
    );

    return (
      <article className="flex flex-col gap-4">
        <header className="flex items-center gap-2">
          <SiteCardIcon
            card={card}
            siteIcon={session.view.siteIconOf(card)}
            locale={pageLanguage()}
          />
          <h2 className="min-w-0 flex-1 truncate text-[22px] font-medium text-landing-fg">
            {card.title === '' ? vaultT.list.untitled : card.title}
          </h2>
          {card.favorite && <Star size={ICON_SIZE} aria-label={vaultT.list.badges.favorite} />}
          {card.protected && <Lock size={ICON_SIZE} aria-label={vaultT.list.badges.protected} />}
          {!session.readOnly && !locked && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!session.editing.canStart}
              onClick={() => session.editing.startEditing(card.id)}
            >
              {editorT.edit}
            </Button>
          )}
          <NavLink to={historyPath} className="text-[13px] text-landing-fg-dim underline">
            {vaultT.history.open}
          </NavLink>
          {!session.readOnly && (
            <CardMenu
              card={card}
              session={session}
              onDuplicated={onDuplicated}
              onPurged={onPurged}
            />
          )}
        </header>
        <ConcurrentVersions card={card} session={session} />
        <ExpiryBanner card={card} view={session.view} />
        <RotationBanner card={card} view={session.view} />
        {card.templateId === BANK_CARD_TEMPLATE.id && <PhysicalCard card={card} />}
        {!isNil(changePasswordUrl) && (
          <a
            href={changePasswordUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="self-start text-[13px] text-landing-fg-dim underline"
          >
            {vaultT.cardExtras.changePassword}
          </a>
        )}
        {locked && (
          <div className="flex flex-wrap items-center gap-3">
            <Alert type="info" message={t.protectedNotice} />
            <Button type="button" size="sm" onClick={() => setOpeningGate(true)}>
              {vaultT.protectedGate.open}
            </Button>
          </div>
        )}
        {openingGate && (
          <ProtectedGateDialog session={session} onClose={() => setOpeningGate(false)} />
        )}
        {card.tabs.length > 1 ? (
          <Tabs<TTabId>
            aria-label={t.tabs}
            value={card.tabs.some(tab => tab.id === tabId) ? tabId : firstTab.id}
            onValueChange={setTabId}
            tabs={card.tabs.map(tab => ({
              id: tab.id,
              label: tabLabelOf(tab),
              content: fieldsOf(tab),
            }))}
          />
        ) : (
          fieldsOf(firstTab)
        )}
        <LinkedCards card={card} session={session} onOpen={onOpenCard} />
      </article>
    );
  }
);
