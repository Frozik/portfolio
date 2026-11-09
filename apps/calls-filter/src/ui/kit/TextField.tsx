import { StyleSheet, TextInput } from 'react-native';

import { usePalette } from '../theme/AppTheme';
import { RADIUS, TEXT_SIZE, TOUCH_SIZE } from './metrics';

export function TextField({
  value,
  onChange,
  placeholder,
  testID,
  label,
  keyboard = 'default',
  monospace = false,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly testID?: string;
  readonly label: string;
  readonly keyboard?: 'default' | 'phone-pad';
  readonly monospace?: boolean;
}) {
  const palette = usePalette();
  return (
    <TextInput
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
        { color: palette.fg, borderColor: palette.line, backgroundColor: palette.bgCard },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: TOUCH_SIZE,
    borderRadius: RADIUS,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: TEXT_SIZE.body,
  },
  monospace: { fontFamily: 'monospace', fontSize: TEXT_SIZE.heading },
});
