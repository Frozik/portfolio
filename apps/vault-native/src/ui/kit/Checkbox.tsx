import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePalette } from '../theme/AppTheme';
import { GAP, TEXT_SIZE, TOUCH_SIZE } from './metrics';

const BOX_SIZE = 22;
const BOX_RADIUS = 6;
const TICK_SIZE = 16;

export function Checkbox({
  label,
  checked,
  onChange,
  testID,
}: {
  readonly label: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly testID?: string;
}) {
  const palette = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={() => onChange(!checked)}
      style={styles.row}
    >
      <View
        style={[
          styles.box,
          { borderColor: checked ? palette.accent : palette.line },
          checked && { backgroundColor: palette.accent },
        ]}
      >
        {checked && <MaterialIcons name="check" size={TICK_SIZE} color={palette.onAccent} />}
      </View>
      <Text style={[styles.label, { color: palette.fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: TOUCH_SIZE, flexDirection: 'row', alignItems: 'center', gap: GAP },
  box: {
    width: BOX_SIZE,
    height: BOX_SIZE,
    borderWidth: 2,
    borderRadius: BOX_RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flex: 1, fontSize: TEXT_SIZE.small },
});
