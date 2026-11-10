import type { LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { usePalette } from '../theme/AppTheme';
import { ICON_SIZE, RADIUS, SMALL_GAP, TEXT_SIZE, TOUCH_SIZE } from './metrics';

/** Long enough to see the highlight travel, short enough never to wait for it. */
const SLIDE_MS = 180;
/** The highlight sits this far inside the frame, so the frame shows around it. */
const INSET = 3;
const COMPACT_HEIGHT = 36;

interface ISegment<TValue extends string> {
  readonly value: TValue;
  readonly label: string;
  readonly testID: string;
  readonly icon?: LucideIcon;
  /** The highlight's colour while this segment is chosen; the accent by default. */
  readonly tone?: 'accent' | 'danger' | 'positive';
}

/**
 * A full-width switch between a few choices: the chosen segment's highlight slides to the next,
 * and turns into its colour on the way.
 */
export function SegmentedControl<TValue extends string>({
  segments,
  value,
  onChange,
  compact = false,
}: {
  readonly segments: readonly ISegment<TValue>[];
  readonly value: TValue;
  readonly onChange: (value: TValue) => void;
  /** A lower bar with smaller words, for a switch under each row of a list. */
  readonly compact?: boolean;
}) {
  const palette = usePalette();
  const [width, setWidth] = useState(0);
  const segmentWidth = segments.length === 0 ? 0 : (width - INSET * 2) / segments.length;
  const index = Math.max(
    segments.findIndex(segment => segment.value === value),
    0
  );
  const tones = segments.map(segment => palette[segment.tone ?? 'accent']);
  const positions = segments.map((_segment, position) => position);
  const progress = useSharedValue(index);
  useEffect(() => {
    progress.value = withTiming(index, { duration: SLIDE_MS });
  }, [index, progress]);
  const highlight = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * segmentWidth }],
    backgroundColor:
      tones.length < 2
        ? (tones[0] ?? palette.accent)
        : interpolateColor(progress.value, positions, tones),
  }));
  const measure = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  return (
    <View
      accessibilityRole="tablist"
      onLayout={measure}
      style={[
        styles.frame,
        compact && styles.compactFrame,
        { backgroundColor: palette.bgCard, borderColor: palette.line },
      ]}
    >
      {width === 0 ? null : (
        <Animated.View style={[styles.highlight, { width: segmentWidth }, highlight]} />
      )}
      {segments.map(segment => {
        const selected = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            testID={segment.testID}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(segment.value)}
            style={styles.segment}
          >
            {segment.icon === undefined ? null : (
              <segment.icon color={selected ? palette.onAccent : palette.fgDim} size={ICON_SIZE} />
            )}
            <Text
              style={[
                styles.label,
                compact && styles.compactLabel,
                { color: selected ? palette.onAccent : palette.fg },
              ]}
            >
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flexDirection: 'row',
    height: TOUCH_SIZE,
    padding: INSET,
    borderRadius: RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
  },
  highlight: {
    position: 'absolute',
    top: INSET,
    bottom: INSET,
    left: INSET,
    borderRadius: RADIUS - INSET,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SMALL_GAP,
  },
  label: { fontSize: TEXT_SIZE.body, fontWeight: '600' },
  compactFrame: { height: COMPACT_HEIGHT },
  compactLabel: { fontSize: TEXT_SIZE.small },
});
