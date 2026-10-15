import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { TOUCH_SIZE } from '../kit/metrics';
import { usePalette } from '../theme/AppTheme';

const ICON_SIZE = 18;

/** One of a field's small actions in the editor: an icon with a spoken name. */
export function FieldAction({
  icon,
  label,
  onPress,
  disabled = false,
  testID,
}: {
  readonly icon: ComponentProps<typeof MaterialIcons>['name'];
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly testID?: string;
}) {
  const palette = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={styles.action}
    >
      <MaterialIcons
        name={icon}
        size={ICON_SIZE}
        color={disabled ? palette.fgFaint : palette.fgDim}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: { width: TOUCH_SIZE, height: TOUCH_SIZE, alignItems: 'center', justifyContent: 'center' },
});
