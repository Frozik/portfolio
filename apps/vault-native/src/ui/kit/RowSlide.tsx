import { isNil } from 'lodash-es';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { usePalette } from '../theme/AppTheme';

const SLIDE_MS = 500;

/**
 * A row that slides left as a whole to uncover what lies behind its end, and back. What is behind
 * stays mounted only while it can be seen, so a closed row offers nothing hidden. Given `onClose`,
 * the whole slid row is one press that brings it back.
 */
export function RowSlide({
  open,
  behind,
  children,
  onClose,
  showing,
}: {
  readonly open: boolean;
  readonly behind: ReactNode;
  readonly children: ReactNode;
  readonly onClose?: { readonly label: string; readonly press: () => void };
  /** What the row shows: a list reuses its rows, and one given something else takes its place at once, without sliding. */
  readonly showing?: string;
}) {
  const palette = usePalette();
  const [mounted, setMounted] = useState(open);
  const [behindWidth, setBehindWidth] = useState(0);
  const offset = useSharedValue(0);
  useEffect(() => {
    if (open) {
      setMounted(true);
    }
  }, [open]);
  const shown = useRef(showing);
  useEffect(() => {
    if (shown.current !== showing) {
      shown.current = showing;
      cancelAnimation(offset);
      offset.value = open ? -behindWidth : 0;
      setMounted(open);
      return;
    }
    const timing = { duration: SLIDE_MS, easing: Easing.inOut(Easing.cubic) };
    offset.value = open
      ? withTiming(-behindWidth, timing)
      : withTiming(0, timing, finished => {
          if (finished === true) {
            runOnJS(setMounted)(false);
          }
        });
  }, [open, behindWidth, offset, showing]);
  const sliding = useAnimatedStyle(() => ({ transform: [{ translateX: offset.value }] }));
  return (
    <View style={styles.frame}>
      {(open || mounted) && (
        <View
          style={[styles.behind, { backgroundColor: palette.bgElevated }]}
          onLayout={event => setBehindWidth(event.nativeEvent.layout.width)}
        >
          {behind}
        </View>
      )}
      <Animated.View style={[{ backgroundColor: palette.bg }, sliding]}>
        {children}
        {open && !isNil(onClose) && (
          <Pressable
            testID="row-slide-close"
            accessibilityRole="button"
            accessibilityLabel={onClose.label}
            onPress={onClose.press}
            style={StyleSheet.absoluteFill}
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  behind: { position: 'absolute', top: 0, bottom: 0, right: 0, flexDirection: 'row' },
});
