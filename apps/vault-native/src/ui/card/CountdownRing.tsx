import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

const MS_PER_SECOND = 1000;
const SIZE = 24;
const STROKE = 3;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * What is left of a code's period as a ring that empties: it is told the time once a
 * tick and glides to where the next tick will find it, so it moves smoothly in between.
 */
export function CountdownRing({
  leftMs,
  periodMs,
  tickMs,
  color,
  trackColor,
  label,
  testID,
}: {
  readonly leftMs: number;
  readonly periodMs: number;
  readonly tickMs: number;
  readonly color: string;
  readonly trackColor: string;
  /** What a screen reader says; the seconds go in the value. */
  readonly label: string;
  readonly testID?: string;
}) {
  const share = useSharedValue(leftMs / periodMs);
  useEffect(() => {
    share.value = leftMs / periodMs;
    share.value = withTiming(Math.max(0, leftMs - tickMs) / periodMs, {
      duration: Math.min(tickMs, leftMs),
      easing: Easing.linear,
    });
  }, [share, leftMs, periodMs, tickMs]);
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - share.value),
  }));
  return (
    <Svg
      testID={testID}
      width={SIZE}
      height={SIZE}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{
        min: 0,
        max: Math.round(periodMs / MS_PER_SECOND),
        now: Math.ceil(leftMs / MS_PER_SECOND),
      }}
    >
      <Circle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        stroke={trackColor}
        strokeWidth={STROKE}
        fill="none"
      />
      <AnimatedCircle
        cx={SIZE / 2}
        cy={SIZE / 2}
        r={RADIUS}
        stroke={color}
        strokeWidth={STROKE}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={CIRCUMFERENCE}
        animatedProps={animatedProps}
        rotation={-90}
        origin={`${SIZE / 2}, ${SIZE / 2}`}
      />
    </Svg>
  );
}
