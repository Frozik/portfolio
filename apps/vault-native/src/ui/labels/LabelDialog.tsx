import type { TCardColor } from '@frozik/vault/model/card';
import { isNil } from 'lodash-es';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { ColorSwatches } from '../editor/ColorSwatches';
import { Button } from '../kit/Button';
import { Dialog } from '../kit/Dialog';
import { TEXT_SIZE } from '../kit/metrics';
import { TextField } from '../kit/TextField';
import { useSettingsTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';

export interface ILabelDraft {
  readonly name: string;
  readonly color: TCardColor | null;
}

/** A label's name and colour, new or as it is; an existing one can also be deleted from here. */
export function LabelDialog({
  title,
  initial,
  onSave,
  onDelete,
  onClose,
}: {
  readonly title: string;
  readonly initial: ILabelDraft;
  readonly onSave: (label: ILabelDraft) => void;
  /** Absent for a label not made yet. */
  readonly onDelete?: () => void;
  readonly onClose: () => void;
}) {
  const palette = usePalette();
  const t = useSettingsTexts().labels;
  const [name, setName] = useState(initial.name);
  const [color, setColor] = useState(initial.color);
  const [deleting, setDeleting] = useState(false);
  const trimmed = name.trim();
  return (
    <Dialog open title={title} onClose={onClose}>
      <TextField testID="label-name" label={t.name} value={name} onChangeText={setName} />
      <Text style={[styles.caption, { color: palette.fgDim }]}>{t.color}</Text>
      <ColorSwatches value={color} onChange={setColor} testIDPrefix="label-color" />
      <Button
        testID="label-save"
        label={t.save}
        disabled={trimmed === ''}
        onPress={() => onSave({ name: trimmed, color })}
      />
      {!isNil(onDelete) &&
        (deleting ? (
          <>
            <Text style={[styles.caption, { color: palette.fgDim }]}>{t.deleteMessage}</Text>
            <Button
              testID="label-delete-confirm"
              variant="danger"
              label={t.delete}
              onPress={onDelete}
            />
          </>
        ) : (
          <Button
            testID="label-delete"
            variant="secondary"
            label={t.delete}
            onPress={() => setDeleting(true)}
          />
        ))}
      <Button variant="secondary" label={t.cancel} onPress={onClose} />
    </Dialog>
  );
}

const styles = StyleSheet.create({
  caption: { fontSize: TEXT_SIZE.small },
});
