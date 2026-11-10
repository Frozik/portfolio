import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePalette } from '../theme/AppTheme';
import { DIMMED_OPACITY, GAP, GUTTER, SMALL_GAP, TEXT_SIZE, TOUCH_SIZE } from './metrics';

/** A row of a section: a title, a line under it, and whatever sits at the end. */
export function Row({
  title,
  titleTrailing,
  subtitle,
  leading,
  trailing,
  onPress,
  onLongPress,
  selected,
  testID,
}: {
  readonly title: string;
  /** A mark right after the title, such as a pin. */
  readonly titleTrailing?: ReactNode;
  readonly subtitle?: ReactNode;
  readonly leading?: ReactNode;
  readonly trailing?: ReactNode;
  readonly onPress?: () => void;
  readonly onLongPress?: () => void;
  /** The row is the chosen one of a list. */
  readonly selected?: boolean;
  readonly testID?: string;
}) {
  const palette = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole={onPress === undefined ? undefined : 'button'}
      accessibilityState={selected === undefined ? undefined : { selected }}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={onPress === undefined && onLongPress === undefined}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: palette.lineSoft },
        pressed && styles.dimmed,
      ]}
    >
      {leading}
      <View style={styles.text}>
        <View style={styles.titleLine}>
          <Text style={[styles.title, { color: palette.fg }]} numberOfLines={2}>
            {title}
          </Text>
          {titleTrailing}
        </View>
        {subtitle === undefined ? null : (
          <Text style={[styles.subtitle, { color: palette.fgDim }]} numberOfLines={3}>
            {subtitle}
          </Text>
        )}
      </View>
      {trailing}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: TOUCH_SIZE + 8,
    paddingHorizontal: GUTTER,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: { flex: 1, gap: 2 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: SMALL_GAP },
  title: { flexShrink: 1, fontSize: TEXT_SIZE.body, fontWeight: '500' },
  subtitle: { fontSize: TEXT_SIZE.small },
  dimmed: { opacity: DIMMED_OPACITY },
});
