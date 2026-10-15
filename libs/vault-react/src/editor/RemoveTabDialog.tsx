import { Select } from '@frozik/components/components/select/Select';
import type { ICardState, ICardTab } from '@frozik/vault/model/card';
import type { TTabId } from '@frozik/vault/model/ids';
import type { TRemovedTabFields } from '@frozik/vault/model/tab-edits';
import { useState } from 'react';

import { Button } from '@frozik/components/ui/Button';
import { DialogShell } from '@frozik/components/ui/DialogShell';
import { editorT } from '../texts/editor';
import { LANGUAGE } from '../texts/language';
import { tabLabelOf } from './tab-label';

/** A tab with fields goes only once its fields have a place: another tab, or nowhere. */
export function RemoveTabDialog({
  card,
  tab,
  onRemove,
  onClose,
}: {
  readonly card: ICardState;
  readonly tab: ICardTab;
  readonly onRemove: (fields: TRemovedTabFields) => void;
  readonly onClose: () => void;
}) {
  const t = editorT.tabs;
  const others = card.tabs.filter(candidate => candidate.id !== tab.id);
  const [target, setTarget] = useState<TTabId | undefined>(others[0]?.id);
  return (
    <DialogShell
      open
      onClose={onClose}
      title={t.removeTitle(tabLabelOf(tab))}
      description={t.removeMessage(tab.fields.length)}
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t.keep}
          </Button>
          <Button type="button" variant="ghost" onClick={() => onRemove({ kind: 'delete' })}>
            {t.removeWithFields}
          </Button>
          <Button
            type="button"
            disabled={target === undefined}
            onClick={() => target !== undefined && onRemove({ kind: 'move-to', tabId: target })}
          >
            {t.moveAndRemove}
          </Button>
        </>
      }
    >
      <label className="flex flex-col gap-1.5 text-[13px] text-landing-fg-dim">
        {t.moveFieldsTo}
        <Select<TTabId>
          aria-label={t.moveFieldsTo}
          options={others.map(other => ({ value: other.id, label: tabLabelOf(other) }))}
          value={target}
          onValueChange={setTarget}
          locale={LANGUAGE}
        />
      </label>
    </DialogShell>
  );
}
