import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { isNil } from 'lodash-es';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { usePalette } from '../theme/AppTheme';
import { BottomSheet } from './BottomSheet';
import { FieldButton } from './FieldButton';
import { GAP, GUTTER, TEXT_SIZE, TOUCH_SIZE } from './metrics';
import type { IOption } from './OptionList';

const CHECK_SIZE = 22;

/** One choice of a list, shown as its current value; the list opens from the bottom on a tap, the chosen one ticked, and closes on a choice. */
export function Select<T extends string>({
  label,
  options,
  value,
  onChange,
  testID,
  placeholder = '',
}: {
  readonly label: string;
  readonly options: readonly IOption<T>[];
  /** `null` while nothing is chosen: the field shows `placeholder`. */
  readonly value: T | null;
  readonly placeholder?: string;
  readonly onChange: (value: T) => void;
  readonly testID?: string;
}) {
  const palette = usePalette();
  const [open, setOpen] = useState(false);
  const current = options.find(option => option.value === value);
  return (
    <>
      <FieldButton
        testID={testID}
        label={label}
        value={current?.label ?? placeholder}
        faint={isNil(current)}
        onPress={() => setOpen(true)}
      />
      <BottomSheet open={open} title={label} onClose={() => setOpen(false)}>
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
                style={({ pressed }) => [
                  styles.option,
                  { borderBottomColor: palette.lineSoft },
                  pressed && { backgroundColor: palette.bgCard },
                ]}
              >
                <Text
                  style={[
                    styles.value,
                    { color: chosen ? palette.accent : palette.fg },
                    chosen && styles.chosen,
                  ]}
                >
                  {option.label}
                </Text>
                {chosen && <MaterialIcons name="check" size={CHECK_SIZE} color={palette.accent} />}
              </Pressable>
            );
          })}
        </View>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  value: { flex: 1, fontSize: TEXT_SIZE.body },
  option: {
    minHeight: TOUCH_SIZE + 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: GAP,
    paddingHorizontal: GUTTER,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chosen: { fontWeight: '600' },
});
