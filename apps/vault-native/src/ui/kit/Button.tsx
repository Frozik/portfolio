import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { usePalette } from '../theme/AppTheme';
import { RADIUS, TEXT_SIZE, TOUCH_SIZE } from './metrics';

export function Button({
  label,
  onPress,
  testID,
  variant = 'primary',
  disabled = false,
  icon,
  compact = false,
  iconOnly = false,
  trailing,
}: {
  readonly label: string;
  readonly onPress: () => void;
  readonly testID?: string;
  readonly variant?: 'primary' | 'secondary' | 'danger';
  readonly disabled?: boolean;
  /** Drawn before the label, in its colour. */
  readonly icon?: ComponentProps<typeof MaterialIcons>['name'];
  /** Sized to its label, for a row of actions rather than a column. */
  readonly compact?: boolean;
  /** Only the icon is drawn; the label is what a screen reader says. */
  readonly iconOnly?: boolean;
  /** A short note at the button's end, such as how far its work has got. */
  readonly trailing?: string;
}) {
  const palette = usePalette();
  const filled = variant === 'primary';
  const color = variant === 'danger' ? palette.danger : filled ? palette.onAccent : palette.fg;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={iconOnly ? label : undefined}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        filled
          ? { backgroundColor: palette.accent }
          : { borderColor: palette.line, borderWidth: 1, backgroundColor: palette.bgCard },
        (pressed || disabled) && styles.dimmed,
      ]}
    >
      {icon !== undefined && (
        <MaterialIcons name={icon} size={iconOnly ? ICON_ONLY_SIZE : ICON_SIZE} color={color} />
      )}
      {!iconOnly && <Text style={[styles.label, { color }]}>{label}</Text>}
      {trailing !== undefined && (
        <Text
          testID={testID === undefined ? undefined : `${testID}-trailing`}
          style={[styles.trailing, { color }]}
        >
          {trailing}
        </Text>
      )}
    </Pressable>
  );
}

const DIMMED_OPACITY = 0.6;
const ICON_SIZE = 20;
const ICON_ONLY_SIZE = 26;

const styles = StyleSheet.create({
  button: {
    minHeight: TOUCH_SIZE,
    borderRadius: RADIUS,
    paddingHorizontal: 20,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: { paddingHorizontal: 12 },
  label: { fontSize: TEXT_SIZE.body, fontWeight: '600' },
  trailing: {
    position: 'absolute',
    right: 16,
    fontSize: TEXT_SIZE.small,
    fontVariant: ['tabular-nums'],
  },
  dimmed: { opacity: DIMMED_OPACITY },
});
