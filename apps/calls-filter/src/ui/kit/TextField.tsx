import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { usePalette } from '../theme/AppTheme';
import { RADIUS, TEXT_SIZE, TOUCH_SIZE } from './metrics';

const FIELD_PADDING = 14;

export function TextField({
  value,
  onChange,
  placeholder,
  testID,
  label,
  keyboard = 'default',
  monospace = false,
  focusWhenShown = false,
  trailing,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly testID?: string;
  readonly label: string;
  readonly keyboard?: 'default' | 'phone-pad';
  readonly monospace?: boolean;
  /** Opened by a tap on purpose: the keyboard comes up with it. */
  readonly focusWhenShown?: boolean;
  /** A touch-sized button inside the field's end, such as one that clears it. */
  readonly trailing?: ReactNode;
}) {
  const palette = usePalette();
  const ref = useRef<TextInput>(null);
  useEffect(() => {
    if (focusWhenShown) {
      ref.current?.focus();
    }
  }, [focusWhenShown]);
  const input = (
    <TextInput
      ref={ref}
      testID={testID}
      accessibilityLabel={label}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={palette.fgFaint}
      keyboardType={keyboard}
      autoCorrect={false}
      autoCapitalize="none"
      style={[
        styles.field,
        monospace && styles.monospace,
        trailing === undefined ? null : styles.roomForTrailing,
        { color: palette.fg, borderColor: palette.line, backgroundColor: palette.bgCard },
      ]}
    />
  );
  if (trailing === undefined) {
    return input;
  }
  return (
    <View>
      {input}
      <View style={styles.trailing}>{trailing}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: TOUCH_SIZE,
    borderRadius: RADIUS,
    borderWidth: 1,
    paddingHorizontal: FIELD_PADDING,
    fontSize: TEXT_SIZE.body,
  },
  roomForTrailing: { paddingRight: TOUCH_SIZE },
  trailing: { position: 'absolute', top: 0, right: 0, bottom: 0, justifyContent: 'center' },
  monospace: { fontFamily: 'monospace', fontSize: TEXT_SIZE.heading },
});
