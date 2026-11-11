import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { usePalette } from '../theme/AppTheme';
import { RADIUS, TOUCH_SIZE } from './metrics';

const ICON_SIZE = 24;

/** An icon button that stays pressed while what it shows is in sight. */
export function IconToggle({
  icon,
  label,
  value,
  onChange,
  testID,
}: {
  readonly icon: ComponentProps<typeof MaterialIcons>['name'];
  readonly label: string;
  readonly value: boolean;
  readonly onChange: (value: boolean) => void;
  readonly testID: string;
}) {
  const palette = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: value }}
      onPress={() => onChange(!value)}
      style={[styles.toggle, value && { backgroundColor: palette.accentSoft }]}
    >
      <MaterialIcons name={icon} size={ICON_SIZE} color={value ? palette.accent : palette.fgDim} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toggle: {
    width: TOUCH_SIZE,
    height: TOUCH_SIZE,
    borderRadius: RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
