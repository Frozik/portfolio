import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePalette } from '../theme/AppTheme';
import {
  DIMMED_OPACITY,
  GAP,
  GUTTER,
  IDLE_OPACITY,
  SMALL_GAP,
  TEXT_SIZE,
  TOUCH_SIZE,
} from './metrics';

/** A setting's name reads whole on a narrow phone with a large font; only a very long group name is cut. */
const ROW_TITLE_LINES = 3;

/** A row of a section: a title, a line under it, and whatever sits at the end. */
export function Row({
  title,
  idle = false,
  titleTrailing,
  subtitle,
  leading,
  backdrop,
  separator = 'full',
  trailing,
  onPress,
  onLongPress,
  selected,
  testID,
}: {
  readonly title: string;
  /** The row's subject is not in effect now: its title fades. */
  readonly idle?: boolean;
  /** A mark right after the title, such as a pin. */
  readonly titleTrailing?: ReactNode;
  readonly subtitle?: ReactNode;
  readonly leading?: ReactNode;
  /** Drawn behind the whole row, under its content. */
  readonly backdrop?: ReactNode;
  /** The line under the row: across the whole width, short of both edges, or none when what follows belongs to it. */
  readonly separator?: 'full' | 'inset' | 'none';
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
      style={({ pressed }) => [styles.row, pressed && styles.dimmed]}
    >
      {backdrop}
      {leading}
      <View style={styles.text}>
        <View style={styles.titleLine}>
          <Text
            testID={testID === undefined ? undefined : `${testID}-title`}
            style={[styles.title, { color: palette.fg }, idle && styles.idle]}
            numberOfLines={ROW_TITLE_LINES}
          >
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
      {separator === 'none' ? null : (
        <View
          style={[
            styles.separator,
            separator === 'inset' && styles.inset,
            { backgroundColor: palette.lineSoft },
          ]}
        />
      )}
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
    overflow: 'hidden',
  },
  separator: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
  },
  inset: { left: GUTTER, right: GUTTER },
  text: { flex: 1, gap: 2 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: SMALL_GAP },
  title: { flexShrink: 1, fontSize: TEXT_SIZE.body, fontWeight: '500' },
  subtitle: { fontSize: TEXT_SIZE.small },
  dimmed: { opacity: DIMMED_OPACITY },
  idle: { opacity: IDLE_OPACITY },
});
