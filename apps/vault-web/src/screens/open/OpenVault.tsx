import { cn } from '@frozik/components/components/cn';
import { assertNever } from '@frozik/utils/assert/assertNever';
import type { TTemplateId } from '@frozik/vault/model/ids';
import { get, isNil } from 'lodash-es';
import { Lock } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { Suspense, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useEventCallback } from 'usehooks-ts';

import { Button } from '@frozik/components/ui/Button';
import { Spinner } from '@frozik/components/ui/Spinner';
import type { TVaultPage } from '@frozik/vault-app/navigation/vault-pages';
import type { VaultApp } from '@frozik/vault-app/session/application/VaultApp';
import type { VaultSession } from '@frozik/vault-app/session/application/VaultSession';
import { ThemeMenu } from '@frozik/vault-react/appearance/ThemeMenu';
import { ForeignVaultDialog } from '@frozik/vault-react/session/ForeignVaultDialog';
import { translateTemplateKey } from '@frozik/vault-react/texts/templates';
import { vaultT } from '@frozik/vault-react/texts/vault';
import { AuditPage, CardHistory, EditorScreen, SettingsScreen } from '../lazy-screens';
import { paths } from '../paths';
import { useWideLayout } from '../wide-layout';
import type { TBottomTab } from './BottomTabs';
import { BottomTabs } from './BottomTabs';
import { BrowsePanes } from './BrowsePanes';
import { CardListScreen } from './CardListScreen';
import { CardScreen } from './CardScreen';
import { CopySnackbar } from './CopySnackbar';
import { HeaderTabs } from './HeaderTabs';
import { ReminderSheet } from './ReminderSheet';
import { SessionNotices } from './SessionNotices';
import { SyncChip } from './SyncChip';

const ICON_SIZE = 18;

type TShownPage = Exclude<TVaultPage, { readonly kind: 'unknown' }>;

function tabOf(page: TShownPage, searching: boolean): TBottomTab | null {
  switch (page.kind) {
    case 'section':
      return searching ? 'search' : 'vault';
    case 'audit':
    case 'settings':
      return page.kind;
    case 'card':
    case 'history':
      return null;
    default:
      return assertNever(page);
  }
}

/**
 * An open vault: its name, the cloud and the lock on top; on a phone the page and the tabs below,
 * on a wide screen the tabs in the header and the sections, list and card side by side.
 */
export const OpenVault = observer(
  ({
    app,
    session,
    page,
    version,
  }: {
    readonly app: VaultApp;
    readonly session: VaultSession;
    readonly page: TShownPage;
    readonly version: string;
  }) => {
    const { state } = useLocation();
    const navigate = useNavigate();
    const [copiedLabel, setCopiedLabel] = useState<string | null>(null);
    const section = 'section' in page ? page.section : 'all';
    const { view, vaultKey } = session;
    const cardId = 'cardId' in page ? page.cardId : null;
    const { draft } = session.editing;
    const editing = !isNil(draft) && draft.card.id === cardId ? draft : null;

    useEffect(() => {
      view.show(section);
    }, [view, section]);
    const opened = !isNil(cardId) && session.document.cards.has(cardId);
    useEffect(() => {
      if (opened && !isNil(cardId)) {
        session.recent.opened(cardId);
      }
    }, [session, cardId, opened]);
    useEffect(() => {
      session.reveal.hideAll();
    }, [session, cardId]);

    const create = useEventCallback((templateId: TTemplateId) => {
      const created = session.editing.startCreating(templateId, translateTemplateKey);
      if (!isNil(created)) {
        void navigate(paths.card(vaultKey, section, created));
      }
    });

    const wide = useWideLayout();
    const cardPane = (() => {
      switch (page.kind) {
        case 'card':
          return isNil(editing) ? (
            <CardScreen
              session={session}
              section={page.section}
              cardId={page.cardId}
              onCopied={setCopiedLabel}
            />
          ) : (
            <EditorScreen session={session} section={page.section} draft={editing} />
          );
        case 'history': {
          const card = session.document.cards.get(page.cardId);
          return isNil(card) ? (
            <CardScreen
              session={session}
              section={page.section}
              cardId={page.cardId}
              onCopied={setCopiedLabel}
            />
          ) : (
            <div className="overflow-y-auto px-4 pt-3 pb-8">
              <CardHistory
                card={card}
                session={session}
                backTo={paths.card(vaultKey, page.section, card.id)}
              />
            </div>
          );
        }
        default:
          return null;
      }
    })();
    const list = <CardListScreen session={session} selectedId={cardId} onCreate={create} />;

    const content = (() => {
      switch (page.kind) {
        case 'card':
        case 'history':
        case 'section':
          if (wide) {
            return <BrowsePanes vaultKey={vaultKey} view={view} list={list} card={cardPane} />;
          }
          return cardPane ?? list;
        case 'audit':
          return (
            <div className="overflow-y-auto px-4 pt-3 pb-8">
              <AuditPage session={session} paths={paths} />
            </div>
          );
        case 'settings':
          return <SettingsScreen app={app} session={session} version={version} />;
        default:
          return assertNever(page);
      }
    })();
    const tab = tabOf(page, get(state, 'search') === true);

    return (
      <div
        className={cn('mx-auto flex h-dvh w-full flex-col', wide ? 'max-w-[1440px]' : 'max-w-xl')}
      >
        <header className="flex items-center gap-3 border-b border-line px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
          <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-fg">
            {session.document.settings.name}
          </span>
          {wide && <HeaderTabs vaultKey={vaultKey} current={tab ?? 'vault'} />}
          <SyncChip cloud={session.cloud} />
          <ThemeMenu appearance={app.appearance} texts={vaultT.appearance} />
          <Button
            type="button"
            variant="ghost"
            className="size-11 p-0"
            aria-label={vaultT.session.lock}
            data-testid="lock"
            onClick={() => app.lock('manual')}
          >
            <Lock size={ICON_SIZE} aria-hidden />
          </Button>
        </header>
        <SessionNotices session={session} section={section} />
        <main
          className={cn(
            'flex min-h-0 flex-1 flex-col',
            wide &&
              (page.kind === 'audit' || page.kind === 'settings') &&
              'mx-auto w-full max-w-3xl'
          )}
        >
          <Suspense fallback={<Spinner />}>{content}</Suspense>
        </main>
        {!wide && <BottomTabs vaultKey={vaultKey} current={tab} />}
        <CopySnackbar clipboard={session.clipboard} label={copiedLabel} now={session.now} />
        <ReminderSheet reminder={session.reminder} />
        <ForeignVaultDialog
          session={session}
          onDisconnect={() => void app.cloud.disconnect(session)}
        />
      </div>
    );
  }
);
