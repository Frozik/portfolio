import type { ICardState, ICardTab } from '@frozik/vault/model/card';
import { moveTab, removeTab, renameTab } from '@frozik/vault/model/tab-edits';
import { useState } from 'react';

import { Button } from '../kit/Button';
import { Dialog } from '../kit/Dialog';
import { TextField } from '../kit/TextField';
import { useEditorTexts } from '../texts';

/** One tab's name, place and removal; its fields go to the first other tab, or with it. */
export function TabDialog({
  card,
  tab,
  label,
  onChange,
  onClose,
}: {
  readonly card: ICardState;
  readonly tab: ICardTab;
  readonly label: string;
  readonly onChange: (edit: (card: ICardState) => ICardState) => void;
  readonly onClose: () => void;
}) {
  const editorTexts = useEditorTexts();
  const t = editorTexts.tabs;
  const [title, setTitle] = useState(tab.title ?? '');
  const index = card.tabs.findIndex(other => other.id === tab.id);
  const otherTab = card.tabs.find(other => other.id !== tab.id);
  const apply = (edit: (state: ICardState) => ICardState): void => {
    onChange(edit);
    onClose();
  };
  return (
    <Dialog testID="tab-dialog" open title={label} onClose={onClose}>
      <TextField label={t.name} value={title} onChangeText={setTitle} />
      <Button
        label={editorTexts.save}
        onPress={() =>
          apply(state => renameTab(state, tab.id, title.trim() === '' ? null : title.trim()))
        }
      />
      <Button
        variant="secondary"
        label={t.moveLeft}
        disabled={index <= 0}
        onPress={() => apply(state => moveTab(state, tab.id, index - 1))}
      />
      <Button
        variant="secondary"
        label={t.moveRight}
        disabled={index >= card.tabs.length - 1}
        onPress={() => apply(state => moveTab(state, tab.id, index + 1))}
      />
      {otherTab !== undefined && tab.fields.length > 0 && (
        <Button
          variant="secondary"
          label={t.moveAndRemove}
          onPress={() =>
            apply(state => removeTab(state, tab.id, { kind: 'move-to', tabId: otherTab.id }))
          }
        />
      )}
      {otherTab !== undefined && (
        <Button
          variant="danger"
          label={tab.fields.length > 0 ? t.removeWithFields : t.remove}
          onPress={() => apply(state => removeTab(state, tab.id, { kind: 'delete' }))}
        />
      )}
    </Dialog>
  );
}
