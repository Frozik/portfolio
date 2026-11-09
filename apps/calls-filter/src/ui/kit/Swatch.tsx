import { Pressable, StyleSheet } from 'react-native';

import { usePalette } from '../theme/AppTheme';

const SWATCH_SIZE = 32;
const RING = 3;

/** One colour to pick: a dot, ringed when it is the chosen one. */
export function Swatch({
  color,
  selected,
  label,
  onPress,
  testID,
}: {
  readonly color: string;
  readonly selected: boolean;
  readonly label: string;
  readonly onPress: () => void;
  readonly testID: string;
}) {
  const palette = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={4}
      style={[
        styles.swatch,
        { backgroundColor: color },
        selected && { borderWidth: RING, borderColor: palette.fg },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  swatch: { width: SWATCH_SIZE, height: SWATCH_SIZE, borderRadius: SWATCH_SIZE / 2 },
});
