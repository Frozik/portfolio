import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePalette } from '../theme/AppTheme';
import { Dialog } from './Dialog';
import { RADIUS, TEXT_SIZE, TOUCH_SIZE } from './metrics';
import type { IOption } from './OptionList';

const CHEVRON_SIZE = 22;
const RADIO_SIZE = 18;
const DOT_SIZE = 8;

/** One choice of a list, shown as its current value; the list opens on a tap and closes on a choice. */
export function Select<T extends string>({
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
  const [open, setOpen] = useState(false);
  const current = options.find(option => option.value === value);
  return (
    <View style={styles.select}>
      <Text style={[styles.label, { color: palette.fgDim }]}>{label}</Text>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? ''}`}
        onPress={() => setOpen(true)}
        style={[styles.field, { borderColor: palette.line, backgroundColor: palette.bgCard }]}
      >
        <Text numberOfLines={1} style={[styles.value, { color: palette.fg }]}>
          {current?.label ?? ''}
        </Text>
        <MaterialIcons name="expand-more" size={CHEVRON_SIZE} color={palette.fgDim} />
      </Pressable>
      <Dialog open={open} title={label} onClose={() => setOpen(false)}>
        <View accessibilityRole="radiogroup" accessibilityLabel={label}>
          {options.map(option => {
            const chosen = option.value === value;
            return (
              <Pressable
                key={option.value}
                testID={testID === undefined ? undefined : `${testID}-${option.value}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: chosen }}
                onPress={() => {
                  setOpen(false);
                  onChange(option.value);
                }}
                style={styles.option}
              >
                <View
                  style={[styles.radio, { borderColor: chosen ? palette.accent : palette.fgDim }]}
                >
                  {chosen && <View style={[styles.dot, { backgroundColor: palette.accent }]} />}
                </View>
                <Text style={[styles.value, { color: palette.fg }]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Dialog>
    </View>
  );
}

const styles = StyleSheet.create({
  select: { gap: 6 },
  label: { fontSize: TEXT_SIZE.small },
  field: {
    minHeight: TOUCH_SIZE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: RADIUS,
    paddingLeft: 14,
    paddingRight: 10,
  },
  value: { flex: 1, fontSize: TEXT_SIZE.body },
  option: { minHeight: TOUCH_SIZE, flexDirection: 'row', alignItems: 'center', gap: 12 },
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
