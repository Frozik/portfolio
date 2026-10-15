import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePalette } from '../theme/AppTheme';
import { GAP, RADIUS, TEXT_SIZE, TOUCH_SIZE } from './metrics';

/** A whole number within bounds, one step at a time: Android's own spinner pattern without a keyboard. */
export function Stepper({
  label,
  value,
  min,
  max,
  onChange,
  testID,
}: {
  readonly label: string;
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly onChange: (value: number) => void;
  readonly testID?: string;
}) {
  const palette = usePalette();
  const step = (delta: number): void => onChange(Math.min(max, Math.max(min, value + delta)));
  const stepButton = (sign: '-' | '+') => {
    const disabled = sign === '+' ? value >= max : value <= min;
    return (
      <Pressable
        testID={testID === undefined ? undefined : `${testID}-${sign === '+' ? 'more' : 'less'}`}
        accessibilityElementsHidden
        importantForAccessibility="no"
        disabled={disabled}
        onPress={() => step(sign === '+' ? 1 : -1)}
        style={[styles.button, { borderColor: palette.line }, disabled && styles.disabled]}
      >
        <Text style={{ color: palette.fg, fontSize: TEXT_SIZE.heading }}>
          {sign === '+' ? '+' : '−'}
        </Text>
      </Pressable>
    );
  };
  return (
    <View
      testID={testID}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={event => step(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
      style={styles.row}
    >
      <Text style={[styles.label, { color: palette.fgDim }]}>{label}</Text>
      {stepButton('-')}
      <Text style={[styles.value, { color: palette.fg }]}>{value}</Text>
      {stepButton('+')}
    </View>
  );
}

const DISABLED_OPACITY = 0.4;

const styles = StyleSheet.create({
  disabled: { opacity: DISABLED_OPACITY },
  row: { flexDirection: 'row', alignItems: 'center', gap: GAP },
  label: { flex: 1, fontSize: TEXT_SIZE.small },
  button: {
    width: TOUCH_SIZE,
    height: TOUCH_SIZE,
    borderWidth: 1,
    borderRadius: RADIUS,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { minWidth: 32, textAlign: 'center', fontSize: TEXT_SIZE.body },
});
