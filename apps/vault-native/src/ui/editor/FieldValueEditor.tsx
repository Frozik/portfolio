import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ICardField, TFieldValue } from '@frozik/vault/model/card';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '../kit/Button';
import { GAP, TOUCH_SIZE } from '../kit/metrics';
import { useEditorTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { SingleValueEditor } from './SingleValueEditor';

const ICON_SIZE = 20;

/** A field's value in its kind's control; a list field is a list of them, one added or removed at a time. */
export function FieldValueEditor({
  field,
  onChange,
}: {
  readonly field: ICardField;
  readonly onChange: (value: TFieldValue) => void;
}) {
  const palette = usePalette();
  const t = useEditorTexts();
  if (field.value.cardinality === 'single') {
    return (
      <SingleValueEditor
        testID="field-editor"
        spec={field.spec}
        label={field.label}
        value={field.value.value}
        onChange={value => onChange({ cardinality: 'single', value })}
      />
    );
  }
  const values = field.value.values;
  /** An empty list still offers a line to type its first value into. */
  const shown = values.length === 0 ? [''] : values;
  const replace = (index: number, value: string): void =>
    onChange({
      cardinality: 'list',
      values:
        values.length === 0
          ? value === ''
            ? []
            : [value]
          : values.map((current, at) => (at === index ? value : current)),
    });
  return (
    <View style={styles.list}>
      {[...shown.keys()].map(position => (
        <View key={position} style={styles.item}>
          <View style={styles.editor}>
            <SingleValueEditor
              spec={field.spec}
              label={field.label}
              value={shown[position] ?? ''}
              onChange={next => replace(position, next)}
            />
          </View>
          {values.length > 0 && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t.removeValue}
              onPress={() =>
                onChange({ cardinality: 'list', values: values.filter((_, at) => at !== position) })
              }
              style={styles.remove}
            >
              <MaterialIcons name="close" size={ICON_SIZE} color={palette.fgDim} />
            </Pressable>
          )}
        </View>
      ))}
      {values.length > 0 && (
        <Button
          variant="secondary"
          label={t.addValue}
          onPress={() => onChange({ cardinality: 'list', values: [...values, ''] })}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: GAP },
  item: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  editor: { flex: 1 },
  remove: { width: TOUCH_SIZE, height: TOUCH_SIZE, alignItems: 'center', justifyContent: 'center' },
});
