import { TextEditor } from '@frozik/components/components/RichEditor/TextEditor';
import type { ICardState, ICardTab } from '@frozik/vault/model/card';
import type { TRemovedTabFields } from '@frozik/vault/model/tab-edits';
import { moveTab, removeTab, renameTab } from '@frozik/vault/model/tab-edits';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@frozik/components/ui/Button';
import { ConfirmDialog } from '@frozik/components/ui/ConfirmDialog';
import { editorT } from '../texts/editor';
import { vaultT } from '../texts/vault';
import { RemoveTabDialog } from './RemoveTabDialog';
import { tabLabelOf } from './tab-label';

const ICON_SIZE = 14;

/** The open tab of a card with several: its name, its place among the tabs, its removal. */
export function TabControls({
  card,
  tab,
  onChange,
}: {
  readonly card: ICardState;
  readonly tab: ICardTab;
  readonly onChange: (edit: (card: ICardState) => ICardState) => void;
}) {
  const t = editorT.tabs;
  const [removing, setRemoving] = useState(false);
  const index = card.tabs.findIndex(candidate => candidate.id === tab.id);
  const remove = (fields: TRemovedTabFields) => {
    setRemoving(false);
    onChange(state => removeTab(state, tab.id, fields));
  };
  return (
    <div className="flex flex-wrap items-center gap-2 pb-2">
      <div className="min-w-[160px] flex-1">
        <TextEditor
          aria-label={t.name}
          placeholder={vaultT.card.mainTab}
          value={tab.title ?? ''}
          onValueChange={title =>
            onChange(state => renameTab(state, tab.id, title === '' ? null : title))
          }
        />
      </div>
      <span className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t.moveLeft}
          disabled={index <= 0}
          onClick={() => onChange(state => moveTab(state, tab.id, index - 1))}
        >
          <ChevronLeft size={ICON_SIZE} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t.moveRight}
          disabled={index >= card.tabs.length - 1}
          onClick={() => onChange(state => moveTab(state, tab.id, index + 1))}
        >
          <ChevronRight size={ICON_SIZE} />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setRemoving(true)}>
          {t.remove}
        </Button>
      </span>
      <ConfirmDialog
        open={removing && tab.fields.length === 0}
        title={t.removeTitle(tabLabelOf(tab))}
        description={t.removeEmptyMessage}
        confirmLabel={t.removeConfirm}
        cancelLabel={t.keep}
        tone="danger"
        onConfirm={() => remove({ kind: 'delete' })}
        onCancel={() => setRemoving(false)}
      />
      {removing && tab.fields.length > 0 && (
        <RemoveTabDialog
          card={card}
          tab={tab}
          onRemove={remove}
          onClose={() => setRemoving(false)}
        />
      )}
    </div>
  );
}
