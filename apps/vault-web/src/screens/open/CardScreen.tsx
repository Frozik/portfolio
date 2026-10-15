import { Tabs } from '@frozik/components/components/RichEditor/Tabs';
import type { TCardId, TTabId } from '@frozik/vault/model/ids';
import { isNil } from 'lodash-es';
import { ChevronLeft, Lock, Star } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useEventCallback } from 'usehooks-ts';

import { Alert } from '@frozik/components/ui/Alert';
import { Button } from '@frozik/components/ui/Button';
import type { ITabReading } from '@frozik/vault-app/document/application/card-reading';
import { readCard } from '@frozik/vault-app/document/application/card-reading';
import type { TVaultSection } from '@frozik/vault-app/navigation/vault-pages';
import type { VaultSession } from '@frozik/vault-app/session/application/VaultSession';
import { SiteCardIcon } from '@frozik/vault-react/card-icon/SiteCardIcon';
import { CardMenu } from '@frozik/vault-react/card/CardMenu';
import { ConcurrentVersions } from '@frozik/vault-react/card/ConcurrentVersions';
import { ExpiryBanner } from '@frozik/vault-react/card/ExpiryBanner';
import { LinkedCards } from '@frozik/vault-react/card/LinkedCards';
import { PhysicalCard } from '@frozik/vault-react/card/PhysicalCard';
import { RotationBanner } from '@frozik/vault-react/card/RotationBanner';
import { ProtectedGateDialog } from '@frozik/vault-react/protected/ProtectedGateDialog';
import { editorT } from '@frozik/vault-react/texts/editor';
import { LANGUAGE } from '@frozik/vault-react/texts/language';
import { vaultT } from '@frozik/vault-react/texts/vault';
import { paths } from '../paths';
import { useWideLayout } from '../wide-layout';
import { FieldView } from './FieldView';

const ICON_SIZE = 18;

const TabFields = observer(
  ({
    tab,
    session,
    onCopied,
  }: {
    readonly tab: ITabReading;
    readonly session: VaultSession;
    readonly onCopied: (label: string) => void;
  }) => (
    <div className="flex flex-col">
      {tab.fields.map(field => (
        <FieldView key={field.id} field={field} session={session} onCopied={onCopied} />
      ))}
    </div>
  )
);

/** A card as read, full screen on a phone: back to its section, its marks, its fields by tab. */
export const CardScreen = observer(
  ({
    session,
    section,
    cardId,
    onCopied,
  }: {
    readonly session: VaultSession;
    readonly section: TVaultSection;
    readonly cardId: TCardId;
    readonly onCopied: (label: string) => void;
  }) => {
    const navigate = useNavigate();
    const [openingGate, setOpeningGate] = useState(false);
    const openCard = useEventCallback(
      (opened: TCardId) => void navigate(paths.card(session.vaultKey, section, opened))
    );
    const backToSection = useEventCallback(
      () => void navigate(paths.section(session.vaultKey, section))
    );
    const [tabId, setTabId] = useState<TTabId | null>(null);
    const card = session.document.cards.get(cardId);
    const wide = useWideLayout();
    const back = wide ? null : (
      <Link
        to={paths.section(session.vaultKey, section)}
        className="flex min-h-11 items-center gap-1 self-start text-[15px] text-fg-dim no-underline"
        data-testid="back-to-list"
      >
        <ChevronLeft size={ICON_SIZE} aria-hidden />
        {vaultT.card.back}
      </Link>
    );
    if (isNil(card)) {
      return (
        <div className="flex flex-col gap-3 px-4 pt-3">
          {back}
          <Alert type="warning" message={vaultT.phone.cardNotFound} />
        </div>
      );
    }
    const shut = card.protected && !session.protectedGate.isOpen;
    const reading = readCard(card, shut);
    const [firstTab] = reading.tabs;
    const shownTab = reading.tabs.find(tab => tab.id === tabId) ?? firstTab;
    return (
      <article className="flex flex-col gap-4 overflow-y-auto px-4 pt-3 pb-6" data-testid="card">
        {back}
        <header className="flex items-center gap-3">
          <SiteCardIcon card={card} siteIcon={session.view.siteIconOf(card)} locale={LANGUAGE} />
          <h1 className="min-w-0 flex-1 text-[22px] font-semibold break-words text-fg">
            {card.title === '' ? vaultT.list.untitled : card.title}
          </h1>
          {card.favorite && <Star size={ICON_SIZE} aria-label={vaultT.list.badges.favorite} />}
          {card.protected && <Lock size={ICON_SIZE} aria-label={vaultT.list.badges.protected} />}
        </header>
        <div className="flex flex-wrap items-center gap-2">
          {!session.readOnly && !shut && (
            <Button
              type="button"
              variant="secondary"
              data-testid="edit-card"
              disabled={!session.editing.canStart}
              onClick={() => session.editing.startEditing(card.id)}
            >
              {editorT.edit}
            </Button>
          )}
          <Link
            to={paths.history(session.vaultKey, section, card.id)}
            className="flex min-h-11 items-center px-2 text-[14px] text-fg-dim underline"
            data-testid="card-history"
          >
            {vaultT.history.open}
          </Link>
          {!session.readOnly && (
            <CardMenu
              card={card}
              session={session}
              onDuplicated={openCard}
              onPurged={backToSection}
            />
          )}
        </div>
        <ConcurrentVersions card={card} session={session} />
        <ExpiryBanner card={card} view={session.view} />
        <RotationBanner card={card} view={session.view} />
        {reading.bankCard && <PhysicalCard card={card} />}
        {shut && (
          <div className="flex flex-col gap-3">
            <Alert type="info" message={vaultT.card.protectedNotice} />
            <Button
              type="button"
              className="self-start"
              data-testid="open-protected"
              onClick={() => setOpeningGate(true)}
            >
              {vaultT.protectedGate.open}
            </Button>
          </div>
        )}
        {openingGate && (
          <ProtectedGateDialog session={session} onClose={() => setOpeningGate(false)} />
        )}
        {!isNil(reading.changePasswordUrl) && (
          <a
            href={reading.changePasswordUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="self-start text-[14px] text-fg-dim underline"
          >
            {vaultT.cardExtras.changePassword}
          </a>
        )}
        {reading.tabs.length > 1 && !isNil(shownTab) ? (
          <Tabs<TTabId>
            aria-label={vaultT.card.tabs}
            value={shownTab.id}
            onValueChange={setTabId}
            tabs={reading.tabs.map(tab => ({
              id: tab.id,
              label: tab.title ?? vaultT.card.mainTab,
              content: <TabFields tab={tab} session={session} onCopied={onCopied} />,
            }))}
          />
        ) : (
          !isNil(firstTab) && <TabFields tab={firstTab} session={session} onCopied={onCopied} />
        )}
        <LinkedCards card={card} session={session} onOpen={openCard} />
      </article>
    );
  }
);
