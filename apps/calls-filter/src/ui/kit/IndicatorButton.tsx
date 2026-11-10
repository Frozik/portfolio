import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text } from 'react-native';

import { usePalette } from '../theme/AppTheme';
import { DIMMED_OPACITY, GAP, ICON_SIZE, RADIUS, TEXT_SIZE, TOUCH_SIZE } from './metrics';

/** A caption shrinks this far before it would be cut: one word always reads whole. */
const CAPTION_MIN_SCALE = 0.75;
const CAPTIONED_HEIGHT = TOUCH_SIZE + 8;

/** A state shown as an icon that acts: filled while the state holds, outlined while it does not. */
export function IndicatorButton({
  icon: Icon,
  label,
  caption,
  tone,
  filled,
  onPress,
  testID,
}: {
  readonly icon: LucideIcon;
  /** Read out by TalkBack: what the button shows and what a tap does. */
  readonly label: string;
  /** One word beside the icon; with it the button takes an equal share of its row. */
  readonly caption?: string;
  readonly tone: 'accent' | 'danger' | 'positive';
  readonly filled: boolean;
  readonly onPress: () => void;
  readonly testID: string;
}) {
  const palette = usePalette();
  const color = palette[tone];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: filled }}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        caption === undefined ? styles.button : styles.captioned,
        { borderColor: filled ? color : palette.line },
        filled && { backgroundColor: color },
        pressed && styles.dimmed,
      ]}
    >
      <Icon color={filled ? palette.onAccent : color} size={ICON_SIZE} />
      {caption === undefined ? null : (
        <Text
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={CAPTION_MIN_SCALE}
          style={[styles.caption, { color: filled ? palette.onAccent : color }]}
        >
          {caption}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: TOUCH_SIZE,
    height: TOUCH_SIZE,
    borderRadius: RADIUS,
    borderWidth: StyleSheet.hairlineWidth * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captioned: {
    flex: 1,
    height: CAPTIONED_HEIGHT,
    paddingHorizontal: GAP,
    borderRadius: RADIUS,
    borderWidth: StyleSheet.hairlineWidth * 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
  },
  caption: { flexShrink: 1, fontSize: TEXT_SIZE.body, fontWeight: '600' },
  dimmed: { opacity: DIMMED_OPACITY },
});
