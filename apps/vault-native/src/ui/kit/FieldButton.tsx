import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePalette } from '../theme/AppTheme';
import { RADIUS, TEXT_SIZE, TOUCH_SIZE } from './metrics';

const ICON_SIZE = 22;

/** A field that shows a value and opens something on a tap: its label above, a mark at the end. */
export function FieldButton({
  label,
  value,
  faint = false,
  icon = 'expand-more',
  cut = 'end',
  onPress,
  testID,
}: {
  readonly label: string;
  readonly value: string;
  /** The value is a placeholder, not a choice. */
  readonly faint?: boolean;
  readonly icon?: ComponentProps<typeof MaterialIcons>['name'];
  /** Where a value too long for the field loses its text: a path keeps its end. */
  readonly cut?: 'start' | 'end';
  readonly onPress: () => void;
  readonly testID?: string;
}) {
  const palette = usePalette();
  return (
    <View style={styles.select}>
      <Text style={[styles.label, { color: palette.fgDim }]}>{label}</Text>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        onPress={onPress}
        style={[styles.field, { borderColor: palette.line, backgroundColor: palette.bgCard }]}
      >
        <Text
          numberOfLines={1}
          ellipsizeMode={cut === 'start' ? 'head' : 'tail'}
          style={[styles.value, { color: faint ? palette.fgFaint : palette.fg }]}
        >
          {value}
        </Text>
        <MaterialIcons name={icon} size={ICON_SIZE} color={palette.fgDim} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  select: { gap: 6 },
  label: { fontSize: TEXT_SIZE.small },
  field: {
    minHeight: TOUCH_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: RADIUS,
    paddingLeft: 14,
    paddingRight: 10,
  },
  value: { flex: 1, fontSize: TEXT_SIZE.body },
});
