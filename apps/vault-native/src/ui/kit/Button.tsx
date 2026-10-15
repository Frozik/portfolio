import { Pressable, StyleSheet, Text } from 'react-native';

import { usePalette } from '../theme/AppTheme';
import { RADIUS, TEXT_SIZE, TOUCH_SIZE } from './metrics';

export function Button({
  label,
  onPress,
  testID,
  variant = 'primary',
  disabled = false,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly testID?: string;
  readonly variant?: 'primary' | 'secondary' | 'danger';
  readonly disabled?: boolean;
}) {
  const palette = usePalette();
  const filled = variant === 'primary';
  const color = variant === 'danger' ? palette.danger : filled ? palette.onAccent : palette.fg;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        filled
          ? { backgroundColor: palette.accent }
          : { borderColor: palette.line, borderWidth: 1, backgroundColor: palette.bgCard },
        (pressed || disabled) && styles.dimmed,
      ]}
    >
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

const DIMMED_OPACITY = 0.6;

const styles = StyleSheet.create({
  button: {
    minHeight: TOUCH_SIZE,
    borderRadius: RADIUS,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: TEXT_SIZE.body, fontWeight: '600' },
  dimmed: { opacity: DIMMED_OPACITY },
});
