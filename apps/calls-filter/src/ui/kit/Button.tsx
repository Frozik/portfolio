import { Pressable, StyleSheet, Text } from 'react-native';

import { usePalette } from '../theme/AppTheme';
import { DIMMED_OPACITY, RADIUS, TEXT_SIZE, TOUCH_SIZE } from './metrics';

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
  readonly variant?: 'primary' | 'secondary' | 'danger' | 'quiet';
  readonly disabled?: boolean;
}) {
  const palette = usePalette();
  const filled = variant === 'primary';
  const color =
    variant === 'danger'
      ? palette.danger
      : filled
        ? palette.onAccent
        : variant === 'quiet'
          ? palette.accent
          : palette.fg;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        filled && { backgroundColor: palette.accent },
        (variant === 'secondary' || variant === 'danger') && {
          borderColor: palette.line,
          borderWidth: 1,
          backgroundColor: palette.bgCard,
        },
        (pressed || disabled) && styles.dimmed,
      ]}
    >
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: TOUCH_SIZE,
    borderRadius: RADIUS,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: TEXT_SIZE.body, fontWeight: '600' },
  dimmed: { opacity: DIMMED_OPACITY },
});
