import { isNil } from 'lodash-es';
import { useMemo, useRef, useState } from 'react';
import type { GestureResponderEvent, LayoutChangeEvent } from 'react-native';
import { PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { useEventCallback } from 'usehooks-ts';

import { useWidgetTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { PATTERN_SIDE, pointAt } from './pattern-geometry';

const PAD_SIZE = 264;
const CELL = PAD_SIZE / PATTERN_SIDE;
const DOT_SIZE = 20;
const LINE_WIDTH = 4;
const POINTS = Array.from({ length: PATTERN_SIDE * PATTERN_SIDE }, (_, index) => index);

/** A point's centre on the pad, as the line joins it. */
function centreOf(point: number): string {
  const x = ((point % PATTERN_SIDE) + 0.5) * CELL;
  const y = (Math.floor(point / PATTERN_SIDE) + 0.5) * CELL;
  return `${x},${y}`;
}

/**
 * A 3×3 pattern drawn with a finger — down, across the points, up; the pad
 * takes the touch before its points do, so a drawing is read on the pad's own
 * coordinates. TalkBack users tap the points in turn and finish with the
 * pad's own action. The
 * joined points go to `onComplete` as touched; the rules are the caller's.
 * `hideLine` shows nothing of what was joined.
 */
export function PatternPad({
  hideLine = false,
  disabled = false,
  onComplete,
}: {
  readonly hideLine?: boolean;
  readonly disabled?: boolean;
  readonly onComplete: (points: readonly number[]) => void;
}) {
  const palette = usePalette();
  const t = useWidgetTexts().patternPad;
  const [joined, setJoined] = useState<readonly number[]>([]);
  /** Where the finger is on the pad while it draws: the line runs on to it from the last point. */
  const [finger, setFinger] = useState<string | null>(null);
  const joinedRef = useRef<readonly number[]>([]);
  const size = useRef(PAD_SIZE);
  /** Where the pad sits on the screen: a finger's page position, less this, is a position on the pad. */
  const origin = useRef({ x: 0, y: 0 });
  const pad = useRef<View>(null);
  const join = useEventCallback((point: number | null): void => {
    if (point === null || joinedRef.current.at(-1) === point) {
      return;
    }
    joinedRef.current = [...joinedRef.current, point];
    setJoined(joinedRef.current);
  });
  const finish = useEventCallback((): void => {
    const points = joinedRef.current;
    joinedRef.current = [];
    setJoined([]);
    setFinger(null);
    if (points.length > 0) {
      onComplete(points);
    }
  });
  /** A quick unlock has one try: a drawing the system took over is dropped, never sent half done. */
  const abandon = useEventCallback((): void => {
    joinedRef.current = [];
    setJoined([]);
    setFinger(null);
  });
  const responder = useMemo(() => {
    const track = (event: GestureResponderEvent): void => {
      const x = event.nativeEvent.pageX - origin.current.x;
      const y = event.nativeEvent.pageY - origin.current.y;
      join(pointAt(x, y, size.current));
      setFinger(`${x},${y}`);
    };
    /** The page may have scrolled since layout: where the pad sits is read again as a drawing starts. */
    const start = (event: GestureResponderEvent): void => {
      const { pageX, pageY } = event.nativeEvent;
      track(event);
      pad.current?.measureInWindow((x, y) => {
        if (x === origin.current.x && y === origin.current.y) {
          return;
        }
        origin.current = { x, y };
        const first = pointAt(pageX - x, pageY - y, size.current);
        joinedRef.current = [
          ...(first === null ? [] : [first]),
          ...joinedRef.current.slice(1).filter(point => point !== first),
        ];
        setJoined(joinedRef.current);
      });
    };
    return PanResponder.create({
      onStartShouldSetPanResponderCapture: () => !disabled,
      onMoveShouldSetPanResponderCapture: () => !disabled,
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: start,
      onPanResponderMove: track,
      onPanResponderTerminationRequest: () => false,
      onPanResponderRelease: finish,
      onPanResponderTerminate: abandon,
    });
  }, [disabled, join, finish, abandon, size]);
  return (
    <View
      testID="pattern-pad"
      accessibilityLabel={t.label}
      accessibilityHint={t.hint}
      accessibilityActions={[{ name: 'activate', label: t.label }]}
      onAccessibilityAction={finish}
      ref={pad}
      onLayout={(event: LayoutChangeEvent) => {
        size.current = event.nativeEvent.layout.width;
        pad.current?.measureInWindow((x, y) => {
          origin.current = { x, y };
        });
      }}
      style={styles.pad}
      {...responder.panHandlers}
    >
      {!hideLine && (joined.length > 1 || (joined.length > 0 && !isNil(finger))) && (
        <Svg pointerEvents="none" width={PAD_SIZE} height={PAD_SIZE} style={styles.line}>
          <Polyline
            testID="pattern-line"
            points={[...joined.map(centreOf), ...(isNil(finger) ? [] : [finger])].join(' ')}
            fill="none"
            stroke={palette.accent}
            strokeWidth={LINE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      )}
      {POINTS.map(point => {
        const lit = !hideLine && joined.includes(point);
        return (
          <View
            key={point}
            testID={`pattern-point-${point}`}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t.point(
              Math.floor(point / PATTERN_SIDE) + 1,
              (point % PATTERN_SIDE) + 1
            )}
            accessibilityState={{ disabled }}
            accessibilityActions={[{ name: 'activate' }]}
            onAccessibilityAction={() => !disabled && join(point)}
            style={styles.cell}
          >
            <View style={[styles.dot, { backgroundColor: lit ? palette.accent : palette.fgDim }]} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { width: PAD_SIZE, height: PAD_SIZE, flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: CELL, height: CELL, alignItems: 'center', justifyContent: 'center' },
  line: { position: 'absolute', left: 0, top: 0 },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2 },
});
