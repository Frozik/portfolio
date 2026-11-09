import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';

import { usePalette } from '../theme/AppTheme';
import { DIMMED_OPACITY, ICON_SIZE, TOUCH_SIZE } from './metrics';

/** An icon that acts: a full touch target, and its label read out by TalkBack instead of shown. */
export function IconButton({
  icon: Icon,
  label,
  onPress,
  testID,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly onPress: () => void;
  readonly testID: string;
}) {
  const palette = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.button, pressed && styles.dimmed]}
    >
      <Icon color={palette.accent} size={ICON_SIZE} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: TOUCH_SIZE, height: TOUCH_SIZE, alignItems: 'center', justifyContent: 'center' },
  dimmed: { opacity: DIMMED_OPACITY },
});
