import { Pressable, StyleSheet, Text } from 'react-native';

import { usePalette } from '../theme/AppTheme';
import { DIMMED_OPACITY, TEXT_SIZE } from './metrics';

const CHIP_HEIGHT = 36;
const CHIP_RADIUS = 18;

/** A small choice: a selected chip is filled, a plain one outlined; `tint` colours it as a group. */
export function Chip({
  label,
  onPress,
  selected = false,
  tint,
  testID,
}: {
  readonly label: string;
  readonly onPress?: () => void;
  readonly selected?: boolean;
  readonly tint?: string;
  readonly testID?: string;
}) {
  const palette = usePalette();
  const color = tint ?? palette.accent;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      disabled={onPress === undefined}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: selected ? color : palette.line,
          backgroundColor: selected ? color : palette.bgCard,
        },
        pressed && styles.dimmed,
      ]}
    >
      <Text style={[styles.label, { color: selected ? palette.onAccent : (tint ?? palette.fg) }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: CHIP_HEIGHT,
    borderRadius: CHIP_RADIUS,
    borderWidth: 1,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  label: { fontSize: TEXT_SIZE.small, fontWeight: '600' },
  dimmed: { opacity: DIMMED_OPACITY },
});
