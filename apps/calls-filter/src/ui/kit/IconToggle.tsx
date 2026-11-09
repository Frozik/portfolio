import type { LucideIcon } from 'lucide-react-native';
import { useRef } from 'react';
import type { View } from 'react-native';
import { Pressable, StyleSheet } from 'react-native';

import { usePalette } from '../theme/AppTheme';
import { useHoldHints } from './HoldHint';
import { ICON_SIZE, RADIUS, TOUCH_SIZE } from './metrics';

/** An on/off icon: filled when on; holding it explains what it means. */
export function IconToggle({
  icon: Icon,
  title,
  description,
  value,
  onChange,
  testID,
}: {
  readonly icon: LucideIcon;
  readonly title: string;
  readonly description: string;
  readonly value: boolean;
  readonly onChange: (value: boolean) => void;
  readonly testID: string;
}) {
  const palette = usePalette();
  const ref = useRef<View>(null);
  const hints = useHoldHints();
  const showHint = () =>
    ref.current?.measureInWindow((x, y, width, height) =>
      hints.show({ anchor: { x, y, width, height }, title, text: description })
    );
  return (
    <Pressable
      ref={ref}
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={title}
      accessibilityHint={description}
      accessibilityState={{ checked: value }}
      onPress={() => onChange(!value)}
      onLongPress={showHint}
      onPressOut={hints.hide}
      style={[
        styles.toggle,
        value
          ? { backgroundColor: palette.accent, borderColor: palette.accent }
          : { borderColor: palette.line },
      ]}
    >
      <Icon color={value ? palette.onAccent : palette.fgDim} size={ICON_SIZE} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  toggle: {
    width: TOUCH_SIZE,
    height: TOUCH_SIZE,
    borderRadius: RADIUS,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
