import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { usePalette } from '../theme/AppTheme';
import { RADIUS, TOUCH_SIZE } from './metrics';

const ICON_SIZE = 24;
/** The room between the icon and its touch target's edge: a row pulls the button out by it to line the icon up with the page. */
export const ICON_BUTTON_INSET = (TOUCH_SIZE - ICON_SIZE) / 2;
const UNAVAILABLE_OPACITY = 0.4;

/** An action shown only by its icon; its label is what a screen reader says. */
export function IconButton({
  icon,
  label,
  onPress,
  testID,
  disabled = false,
  role = 'button',
}: {
  readonly icon: ComponentProps<typeof MaterialIcons>['name'];
  readonly label: string;
  readonly onPress: () => void;
  readonly testID?: string;
  readonly disabled?: boolean;
  /** `link` for one that leads somewhere rather than acts. */
  readonly role?: 'button' | 'link';
}) {
  const palette = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole={role}
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed && { backgroundColor: palette.bgElevated },
        disabled && styles.unavailable,
      ]}
    >
      <MaterialIcons name={icon} size={ICON_SIZE} color={palette.fgDim} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: TOUCH_SIZE,
    height: TOUCH_SIZE,
    borderRadius: RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unavailable: { opacity: UNAVAILABLE_OPACITY },
});
