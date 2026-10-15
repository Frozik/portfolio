import type { IRichEditorHandle } from '@frozik/components/components/RichEditor/defs';
import { TextEditor } from '@frozik/components/components/RichEditor/TextEditor';
import { get, isNil } from 'lodash-es';
import { ChevronDown } from 'lucide-react';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { Button } from '@frozik/components/ui/Button';
import type { VaultSession } from '@frozik/vault-app/session/application/VaultSession';
import { NewCardMenu } from '@frozik/vault-react/editor/NewCardMenu';
import { vaultT } from '@frozik/vault-react/texts/vault';
import type { TCardId, TTemplateId } from '@frozik/vault/model/ids';
import { useWideLayout } from '../wide-layout';
import { CardList } from './CardList';
import { CardStrip } from './CardStrip';
import { sectionLabelOf } from './section-label';
import { SectionSheet } from './SectionSheet';

const ICON_SIZE = 16;
/** A fine pointer means a keyboard is at hand: the search takes it at once. On touch it waits for the Search tab. */
const FINE_POINTER = '(pointer: fine)';

/** The history state the Search tab sets: the list opens with its search field focused. */
export const SEARCH_STATE = { search: true } as const;

/** A section of the vault: its name (the sections sheet behind it), the search, favourites, the cards. */
export const CardListScreen = observer(
  ({
    session,
    selectedId,
    onCreate,
  }: {
    readonly session: VaultSession;
    readonly selectedId: TCardId | null;
    readonly onCreate: (templateId: TTemplateId) => void;
  }) => {
    const { view, vaultKey } = session;
    const wide = useWideLayout();
    const [sheetOpen, setSheetOpen] = useState(false);
    const search = useRef<IRichEditorHandle>(null);
    const { state } = useLocation();
    const searching = get(state, 'search') === true;
    const current = view.sections.find(entry => entry.section === view.section);
    const sectionTitle = isNil(current) ? vaultT.sections.all : sectionLabelOf(current);

    useEffect(() => {
      if (searching || window.matchMedia(FINE_POINTER).matches) {
        search.current?.focus();
      }
    }, [searching]);

    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="flex flex-col gap-2 px-4 pt-3">
          <div className="flex items-center justify-between gap-3">
            {wide ? (
              <h2 className="truncate text-[17px] font-semibold text-fg">{sectionTitle}</h2>
            ) : (
              <Button
                type="button"
                variant="ghost"
                className="px-0 text-[17px] font-semibold"
                data-testid="open-sections"
                aria-haspopup="dialog"
                onClick={() => setSheetOpen(true)}
              >
                {sectionTitle}
                <ChevronDown size={ICON_SIZE} aria-hidden />
              </Button>
            )}
            {!session.readOnly && (
              <NewCardMenu
                choices={view.templateChoices}
                disabled={!session.editing.canStart}
                onCreate={onCreate}
              />
            )}
          </div>
          <TextEditor
            ref={search}
            aria-label={vaultT.list.search}
            placeholder={vaultT.list.search}
            value={view.query}
            onValueChange={view.setQuery}
            enterKeyHint="done"
          />
        </div>
        {view.section === 'all' && view.query === '' && (
          <>
            <CardStrip
              vaultKey={vaultKey}
              view={view}
              title={vaultT.phone.recent}
              cards={session.recent.cards}
              section="all"
              testId="recent-strip"
            />
            <CardStrip
              vaultKey={vaultKey}
              view={view}
              title={vaultT.phone.favorites}
              cards={view.favorites}
              section="favorites"
              testId="favorites-strip"
            />
          </>
        )}
        <CardList
          vaultKey={vaultKey}
          view={view}
          emptyVault={session.document.cards.size === 0}
          selectedId={selectedId}
        />
        {!wide && (
          <SectionSheet
            vaultKey={vaultKey}
            view={view}
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
          />
        )}
      </div>
    );
  }
);
