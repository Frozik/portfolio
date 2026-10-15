import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePalette } from '../theme/AppTheme';
import { RADIUS, TEXT_SIZE, TOUCH_SIZE } from './metrics';

export interface IOption<T extends string> {
  readonly value: T;
  readonly label: string;
}

/** One choice of a short list, every option in sight and wrapping in rows: Android's radio group. */
export function OptionList<T extends string>({
  label,
  options,
  value,
  onChange,
  testID,
}: {
  readonly label: string;
  readonly options: readonly IOption<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  readonly testID?: string;
}) {
  const palette = usePalette();
  return (
    <View
      testID={testID}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={styles.list}
    >
      <Text style={[styles.label, { color: palette.fgDim }]}>{label}</Text>
      <View style={styles.options}>
        {options.map(option => {
          const chosen = option.value === value;
          return (
            <Pressable
              key={option.value}
              testID={testID === undefined ? undefined : `${testID}-${option.value}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: chosen }}
              onPress={() => onChange(option.value)}
              style={[
                styles.option,
                {
                  borderColor: chosen ? palette.accent : palette.line,
                  backgroundColor: palette.bgCard,
                },
              ]}
            >
              <View
                style={[styles.radio, { borderColor: chosen ? palette.accent : palette.fgDim }]}
              >
                {chosen && <View style={[styles.dot, { backgroundColor: palette.accent }]} />}
              </View>
              <Text style={{ color: palette.fg, fontSize: TEXT_SIZE.body }}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const RADIO_SIZE = 18;
const DOT_SIZE = 8;

const styles = StyleSheet.create({
  list: { gap: 8 },
  label: { fontSize: TEXT_SIZE.small },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    minHeight: TOUCH_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: RADIUS,
    paddingHorizontal: 14,
  },
  radio: {
    width: RADIO_SIZE,
    height: RADIO_SIZE,
    borderRadius: RADIO_SIZE / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2 },
});
