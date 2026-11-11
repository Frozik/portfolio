import type { ICardState, ICardTab } from '@frozik/vault/model/card';
import { moveTab, removeTab, renameTab } from '@frozik/vault/model/tab-edits';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '../kit/Button';
import { Dialog } from '../kit/Dialog';
import { IconButton } from '../kit/IconButton';
import { TEXT_SIZE } from '../kit/metrics';
import { TextField } from '../kit/TextField';
import { useEditorTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';

/**
 * One tab's name, place and removal in one row of actions; a tab with fields asks first, since
 * they go with it. The only tab is never removed.
 */
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
  const palette = usePalette();
  const [title, setTitle] = useState(tab.title ?? '');
  const [removing, setRemoving] = useState(false);
  const index = card.tabs.findIndex(other => other.id === tab.id);
  const otherTab = card.tabs.find(other => other.id !== tab.id);
  const apply = (edit: (state: ICardState) => ICardState): void => {
    onChange(edit);
    onClose();
  };
  const remove = (): void => apply(state => removeTab(state, tab.id, { kind: 'delete' }));
  if (removing) {
    return (
      <Dialog testID="tab-dialog" open title={t.removeTitle(label)} onClose={onClose}>
        <Text style={[styles.message, { color: palette.fgDim }]}>
          {t.removeMessage(tab.fields.length)}
        </Text>
        <Button
          testID="tab-remove-with-fields"
          variant="danger"
          icon="delete-outline"
          label={t.removeWithFields}
          onPress={remove}
        />
        <Button variant="secondary" label={editorTexts.cancel} onPress={() => setRemoving(false)} />
      </Dialog>
    );
  }
  return (
    <Dialog testID="tab-dialog" open title={label} onClose={onClose}>
      <TextField testID="tab-name" label={t.name} value={title} onChangeText={setTitle} />
      <View style={styles.actions}>
        <View style={styles.moves}>
          <IconButton
            testID="tab-move-left"
            icon="chevron-left"
            label={t.moveLeft}
            disabled={index <= 0}
            onPress={() => apply(state => moveTab(state, tab.id, index - 1))}
          />
          <IconButton
            testID="tab-move-right"
            icon="chevron-right"
            label={t.moveRight}
            disabled={index >= card.tabs.length - 1}
            onPress={() => apply(state => moveTab(state, tab.id, index + 1))}
          />
        </View>
        <View style={styles.finish}>
          {otherTab !== undefined && (
            <Button
              testID="tab-remove"
              compact
              variant="danger"
              icon="delete-outline"
              label={t.removeConfirm}
              onPress={() => (tab.fields.length > 0 ? setRemoving(true) : remove())}
            />
          )}
          <Button
            testID="tab-save"
            compact
            icon="check"
            label={editorTexts.save}
            onPress={() =>
              apply(state => renameTab(state, tab.id, title.trim() === '' ? null : title.trim()))
            }
          />
        </View>
      </View>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  message: { fontSize: TEXT_SIZE.small },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  moves: { flexDirection: 'row' },
  finish: { flexDirection: 'row', gap: 8, marginLeft: 'auto' },
});
