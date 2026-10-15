import { StyleSheet, Text, View } from 'react-native';

import { usePalette } from '../theme/AppTheme';
import { RADIUS, TEXT_SIZE } from './metrics';

/** A sentence the screen needs the user to read: an error, a caution or plain information. */
export function Notice({
  message,
  tone = 'info',
  testID,
}: {
  readonly message: string;
  readonly tone?: 'info' | 'caution' | 'error';
  readonly testID?: string;
}) {
  const palette = usePalette();
  const color =
    tone === 'error' ? palette.danger : tone === 'caution' ? palette.caution : palette.fgDim;
  return (
    <View
      testID={testID}
      accessibilityRole={tone === 'error' ? 'alert' : 'text'}
      accessibilityLiveRegion="polite"
      style={[styles.notice, { borderColor: color, backgroundColor: palette.bgElevated }]}
    >
      <Text style={[styles.message, { color }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { borderWidth: 1, borderRadius: RADIUS, padding: 12 },
  message: { fontSize: TEXT_SIZE.small },
});
