import type { LucideIcon } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { usePalette } from '../theme/AppTheme';
import { ICON_SIZE, RADIUS, SMALL_GAP, TEXT_SIZE, TOUCH_SIZE } from './metrics';
import { useWordFit, WholeWordsText } from './WholeWordsText';

/** Long enough to see the highlight travel, short enough never to wait for it. */
const SLIDE_MS = 180;
/** The highlight sits this far inside the frame, so the frame shows around it. */
const INSET = 3;
const COMPACT_HEIGHT = 36;
/** A narrow phone or a large system font wraps a label onto a second line, and the bar grows. */
const LABEL_LINES = 2;
const LABEL_PADDING = 4;
/** A segment's own switch takes this much of its end while it is chosen; the highlight gives way. */
const TOGGLE_SIZE = TOUCH_SIZE - INSET * 2;

/** An on/off icon at the end of a segment, beside its highlight, shown while it is chosen. */
interface ISegmentToggle {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly value: boolean;
  readonly onChange: (value: boolean) => void;
  readonly testID: string;
}

interface ISegment<TValue extends string> {
  readonly value: TValue;
  readonly label: string;
  readonly testID: string;
  readonly icon?: LucideIcon;
  /** The highlight's colour while this segment is chosen; the accent by default. */
  readonly tone?: 'accent' | 'danger' | 'positive';
  readonly toggle?: ISegmentToggle;
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
  const fit = useWordFit(segments.map(segment => segment.label).join('\n'));
  const [width, setWidth] = useState(0);
  const segmentWidth = segments.length === 0 ? 0 : (width - INSET * 2) / segments.length;
  const index = Math.max(
    segments.findIndex(segment => segment.value === value),
    0
  );
  const tones = segments.map(segment => palette[segment.tone ?? 'accent']);
  const positions = segments.map((_segment, position) => position);
  const widths = segments.map((segment, position) =>
    position === index && segment.toggle !== undefined
      ? segmentWidth - TOGGLE_SIZE - INSET
      : segmentWidth
  );
  const progress = useSharedValue(index);
  // Reanimated styles a newly mounted view a frame or more late — later still while a screen
  // slides in — so a highlight drawn only by it left the white label on a white frame. At rest
  // the chosen segment lights itself; the sliding highlight shows only between two segments.
  const [settled, setSettled] = useState(index);
  useEffect(() => {
    progress.value = withTiming(index, { duration: SLIDE_MS });
    const timer = setTimeout(() => setSettled(index), SLIDE_MS);
    return () => clearTimeout(timer);
  }, [index, progress]);
  const highlight = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * segmentWidth }],
    width: widths.length < 2 ? (widths[0] ?? 0) : interpolate(progress.value, positions, widths),
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
      {width === 0 ? null : <Animated.View style={[styles.highlight, highlight]} />}
      {segments.map(segment => {
        const selected = segment.value === value;
        const { toggle } = segment;
        const tone = palette[segment.tone ?? 'accent'];
        return (
          <View key={segment.value} style={styles.segment}>
            <Pressable
              testID={segment.testID}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => onChange(segment.value)}
              style={[
                styles.choice,
                selected &&
                  settled === index && { backgroundColor: tone, borderRadius: RADIUS - INSET },
              ]}
            >
              {segment.icon === undefined ? null : (
                <segment.icon
                  color={selected ? palette.onAccent : palette.fgDim}
                  size={ICON_SIZE}
                />
              )}
              <WholeWordsText
                fit={fit}
                numberOfLines={LABEL_LINES}
                style={[
                  styles.label,
                  compact && styles.compactLabel,
                  { color: selected ? palette.onAccent : palette.fg },
                ]}
              >
                {segment.label}
              </WholeWordsText>
            </Pressable>
            {selected && toggle !== undefined ? (
              <Pressable
                testID={toggle.testID}
                accessibilityRole="switch"
                accessibilityLabel={toggle.label}
                accessibilityState={{ checked: toggle.value }}
                onPress={() => toggle.onChange(!toggle.value)}
                style={[styles.toggle, toggle.value && { backgroundColor: tone }]}
              >
                <toggle.icon color={toggle.value ? palette.onAccent : tone} size={ICON_SIZE} />
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flexDirection: 'row',
    minHeight: TOUCH_SIZE,
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
  segment: { flex: 1, flexDirection: 'row', gap: INSET },
  choice: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SMALL_GAP,
    paddingHorizontal: LABEL_PADDING,
  },
  toggle: {
    width: TOGGLE_SIZE,
    minHeight: TOGGLE_SIZE,
    borderRadius: RADIUS - INSET,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { flexShrink: 1, textAlign: 'center', fontSize: TEXT_SIZE.body, fontWeight: '600' },
  compactFrame: { minHeight: COMPACT_HEIGHT },
  compactLabel: { fontSize: TEXT_SIZE.small },
});
