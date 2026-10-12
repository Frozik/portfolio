import { cn } from '@frozik/components/components/cn';
import type { IVaultCard } from '@frozik/vault/model/card';
import type { TCardId } from '@frozik/vault/model/ids';
import type { TTemplateId } from '@frozik/vault/model/ids';
import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useEventCallback } from 'usehooks-ts';

import { Alert } from '../../../../shared/ui/Alert';
import { Button } from '../../../../shared/ui/Button';
import { Drawer } from '../../../../shared/ui/Drawer';
import type { VaultSession } from '../../application/VaultSession';
import type { TVaultPage } from '../../domain/vault-paths';
import { vaultPaths } from '../../domain/vault-paths';
import { CardHistory } from '../card-view/CardHistory';
import { CardView } from '../card-view/CardView';
import { CardEditor } from '../editor/CardEditor';
import { vaultT } from '../translations';
import { editorT } from '../translations/editor';
import { translateTemplateKey } from '../translations/template-texts';
import { CardListPane } from './CardListPane';
import { KeyRotatedBanner } from './KeyRotatedBanner';
import { KeysChangedNotice } from './KeysChangedNotice';
import { ProtectedDraftGate } from './ProtectedDraftGate';
import { VaultHeader } from './VaultHeader';
import { VaultSidebar } from './VaultSidebar';

type TBrowsePage = Extract<TVaultPage, { readonly kind: 'section' | 'card' | 'history' }>;

function cardIdOf(page: TBrowsePage): TCardId | null {
  return page.kind === 'section' ? null : page.cardId;
}

/**
 * The unlocked vault: sections, the list, the card. The URL
 * is the only owner of the selection; on a phone only the deepest pane shows,
 * so the browser's back button walks the stack.
 */
export const VaultLayout = observer(
  ({
    session,
    page,
    onLock,
  }: {
    readonly session: VaultSession;
    readonly page: TBrowsePage;
    readonly onLock: () => void;
  }) => {
    const navigate = useNavigate();
    const { view, vaultKey } = session;
    const cardId = cardIdOf(page);
    const card = isNil(cardId) ? undefined : session.document.cards.get(cardId);

    useEffect(() => {
      view.show(page.section);
    }, [view, page.section]);

    useEffect(() => {
      session.reveal.hideAll();
    }, [session, cardId]);

    const open = useEventCallback((opened: IVaultCard) => {
      void navigate(vaultPaths.card(vaultKey, page.section, opened.id));
    });
    const create = useEventCallback((templateId: TTemplateId) => {
      const created = session.editing.startCreating(templateId, translateTemplateKey);
      if (!isNil(created)) {
        void navigate(vaultPaths.card(vaultKey, page.section, created));
      }
    });
    const closeEditor = useEventCallback((saved: boolean) => {
      const wasNew = session.editing.draft?.draft.kind === 'new';
      session.editing.close();
      if (wasNew && !saved) {
        void navigate(vaultPaths.section(vaultKey, page.section));
      }
    });
    const continueOffered = useEventCallback(() => {
      const offered = session.editing.offeredDraft;
      session.editing.continueOffered();
      if (!isNil(offered)) {
        void navigate(vaultPaths.card(vaultKey, page.section, offered.card.id));
      }
    });
    const openById = useEventCallback((opened: TCardId) => {
      void navigate(vaultPaths.card(vaultKey, page.section, opened));
    });
    const backToSection = useEventCallback(() => {
      void navigate(vaultPaths.section(vaultKey, page.section));
    });
    const [menuOpen, setMenuOpen] = useState(false);
    const draft = session.editing.draft;
    const editing = !isNil(draft) && draft.card.id === cardId;

    return (
      <section className="flex min-h-0 flex-1 flex-col gap-4">
        <VaultHeader
          session={session}
          onLock={onLock}
          onBack={isNil(cardId) || editing ? null : backToSection}
          onMenu={() => setMenuOpen(true)}
        />
        <Drawer
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          placement="left"
          mobile="side"
          title={vaultT.sidebar.label}
        >
          <VaultSidebar session={session} locked={editing} onNavigate={() => setMenuOpen(false)} />
        </Drawer>
        <KeyRotatedBanner session={session} />
        <KeysChangedNotice keys={session.keys} settingsPath={vaultPaths.settings(vaultKey)} />
        {!isNil(session.editing.offeredDraft) && (
          <div className="flex flex-wrap items-center gap-3">
            <Alert
              type="info"
              message={editorT.offered(
                session.editing.offeredDraft.card.title || vaultT.list.untitled
              )}
            />
            <Button type="button" size="sm" onClick={continueOffered}>
              {editorT.continue}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={session.editing.discardOffered}
            >
              {editorT.discard}
            </Button>
          </div>
        )}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[200px_minmax(260px,1fr)_minmax(320px,1.4fr)]">
          <div className="overflow-y-auto max-lg:hidden">
            <VaultSidebar session={session} locked={editing} />
          </div>
          <div className={cn('flex min-h-0 flex-col', !isNil(cardId) && 'max-lg:hidden')}>
            <CardListPane
              view={view}
              selectedId={cardId}
              modifiedId={
                draft?.dirty === true
                  ? draft.card.id
                  : (session.editing.offeredDraft?.card.id ?? null)
              }
              onOpen={open}
              onCreate={session.readOnly ? null : create}
              createDisabled={editing || !session.editing.canStart}
              importTo={session.document.cards.size === 0 ? vaultPaths.settings(vaultKey) : null}
              onSearchArchive={
                page.section === 'archive'
                  ? null
                  : () => navigate(vaultPaths.section(vaultKey, 'archive'))
              }
            />
          </div>
          <div className={cn('min-h-0 overflow-y-auto', isNil(cardId) && 'max-lg:hidden')}>
            {!isNil(cardId) && (
              <NavLink
                to={vaultPaths.section(vaultKey, page.section)}
                className="mb-3 inline-block text-[13px] text-landing-fg-dim underline lg:hidden"
              >
                {vaultT.card.back}
              </NavLink>
            )}
            {editing && draft.card.protected && !session.protectedGate.isOpen ? (
              <ProtectedDraftGate session={session} />
            ) : editing ? (
              <CardEditor
                onScanOtp={session.editing.scanOtp}
                key={draft.card.id}
                draft={draft}
                random={session.random}
                assets={session.document.assets}
                siteIcon={session.view.siteIconOf(draft.card)}
                readOnly={session.readOnly}
                onClosed={closeEditor}
              />
            ) : isNil(cardId) ? (
              <p className="text-[14px] text-landing-fg-faint">{vaultT.card.choose}</p>
            ) : isNil(card) ? (
              <Alert type="warning" message={vaultT.card.notFound} data-testid="card-not-found" />
            ) : page.kind === 'history' ? (
              <CardHistory
                card={card}
                session={session}
                backTo={vaultPaths.card(vaultKey, page.section, card.id)}
              />
            ) : (
              <CardView
                key={card.id}
                card={card}
                session={session}
                onDuplicated={openById}
                onPurged={backToSection}
                onOpenCard={openById}
                historyPath={vaultPaths.history(vaultKey, page.section, card.id)}
              />
            )}
          </div>
        </div>
      </section>
    );
  }
);
