import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import type { TSectionEntry } from '@frozik/vault-app/document/application/section-entries';

import { Button } from '../kit/Button';
import { GAP, TEXT_SIZE, TOUCH_SIZE } from '../kit/metrics';
import type { TLabelEditing } from '../labels/LabelEditor';
import { LabelEditor } from '../labels/LabelEditor';
import { SectionIcon } from '../list/SectionIcon';
import { useSettingsTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { useSession } from '../vault/session-context';

/** The vault's labels with their colours and counts: renamed, recoloured, added and deleted here. */
export const LabelsSection = observer(function LabelsSection() {
  const session = useSession();
  const palette = usePalette();
  const t = useSettingsTexts().labels;
  const [editing, setEditing] = useState<TLabelEditing | null>(null);
  const labels = session.view.sections.filter(
    (entry): entry is Extract<TSectionEntry, { kind: 'group' }> => entry.kind === 'group'
  );
  return (
    <>
      {labels.length === 0 && (
        <Text style={[styles.text, { color: palette.fgDim }]}>{t.empty}</Text>
      )}
      {labels.map(entry => (
        <Pressable
          key={entry.section}
          testID="label-row"
          accessibilityRole="button"
          accessibilityLabel={t.edit(entry.name)}
          disabled={session.readOnly}
          onPress={() => setEditing({ kind: 'label', groupId: entry.section })}
          style={styles.row}
        >
          <SectionIcon entry={entry} />
          <Text numberOfLines={1} style={[styles.name, { color: palette.fg }]}>
            {entry.name}
          </Text>
          <Text style={[styles.text, { color: palette.fgFaint }]}>{entry.count}</Text>
        </Pressable>
      ))}
      {!session.readOnly && (
        <Button
          testID="label-add"
          variant="secondary"
          label={t.add}
          onPress={() => setEditing({ kind: 'new' })}
        />
      )}
      {!isNil(editing) && <LabelEditor editing={editing} onClose={() => setEditing(null)} />}
    </>
  );
});

const styles = StyleSheet.create({
  row: { minHeight: TOUCH_SIZE, flexDirection: 'row', alignItems: 'center', gap: GAP },
  name: { flex: 1, fontSize: TEXT_SIZE.body },
  text: { fontSize: TEXT_SIZE.small },
});
