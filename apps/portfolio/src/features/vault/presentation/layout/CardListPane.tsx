import type { IRichEditorHandle } from '@frozik/components/components/RichEditor/defs';
import { TextEditor } from '@frozik/components/components/RichEditor/TextEditor';
import { Select } from '@frozik/components/components/select/Select';
import type { IVaultCard } from '@frozik/vault/model/card';
import type { TCardSort } from '@frozik/vault/model/card-sort';
import { CARD_SORTS } from '@frozik/vault/model/card-sort';
import type { TCardId, TTemplateId } from '@frozik/vault/model/ids';
import { observer } from 'mobx-react-lite';
import { useEffect, useRef } from 'react';

import { pageLanguage } from '@frozik/utils/i18n/page-language';
import type { VaultView } from '@frozik/vault-app/document/application/VaultView';
import { NewCardMenu } from '@frozik/vault-react/editor/NewCardMenu';
import { vaultT } from '@frozik/vault-react/texts/vault';
import { VirtualCardList } from '../card-list/VirtualCardList';
import { shortcutLabel } from '../shortcut-label';

const SEARCH_KEY = 'k';

/** Search (focused on unlock and by Ctrl/⌘+K), sort, and the list of the chosen section. */
export const CardListPane = observer(
  ({
    view,
    selectedId,
    modifiedId,
    onOpen,
    onCreate,
    createDisabled,
    onSearchArchive,
    importTo,
  }: {
    readonly view: VaultView;
    readonly selectedId: TCardId | null;
    readonly modifiedId: TCardId | null;
    readonly onOpen: (card: IVaultCard) => void;
    readonly onCreate: ((templateId: TTemplateId) => void) | null;
    /** A card is being edited: no other one starts until it is saved or cancelled. */
    readonly createDisabled: boolean;
    readonly onSearchArchive: (() => void) | null;
    /** An empty vault offers an import, which lives in the settings. */
    readonly importTo: string | null;
  }) => {
    const t = vaultT.list;
    const search = useRef<IRichEditorHandle>(null);

    useEffect(() => {
      search.current?.focus();
      const controller = new AbortController();
      window.addEventListener(
        'keydown',
        event => {
          if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === SEARCH_KEY) {
            event.preventDefault();
            search.current?.focus();
          }
        },
        { signal: controller.signal }
      );
      return () => controller.abort();
    }, []);

    return (
      <section className="flex min-h-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2 px-1">
          <TextEditor
            ref={search}
            className="min-w-[180px] flex-1"
            aria-label={t.search}
            placeholder={`${t.search} (${shortcutLabel('K')})`}
            value={view.query}
            onValueChange={view.setQuery}
          />
          <Select<TCardSort>
            aria-label={t.sort}
            options={CARD_SORTS.map(sort => ({ value: sort, label: t.sorts[sort] }))}
            value={view.sort}
            onValueChange={view.setSort}
            locale={pageLanguage()}
          />
          {onCreate !== null && (
            <NewCardMenu
              choices={view.templateChoices}
              disabled={createDisabled}
              onCreate={onCreate}
            />
          )}
        </div>
        <VirtualCardList
          view={view}
          selectedId={selectedId}
          modifiedId={modifiedId}
          onOpen={onOpen}
          onSearchArchive={onSearchArchive}
          importTo={importTo}
        />
      </section>
    );
  }
);
