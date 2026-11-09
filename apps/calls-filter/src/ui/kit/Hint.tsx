import { StyleSheet, Text } from 'react-native';

import { usePalette } from '../theme/AppTheme';
import { TEXT_SIZE } from './metrics';

export function Hint({
  text,
  tone = 'dim',
  testID,
}: {
  readonly text: string;
  readonly tone?: 'dim' | 'danger' | 'caution';
  readonly testID?: string;
}) {
  const palette = usePalette();
  const color =
    tone === 'danger' ? palette.danger : tone === 'caution' ? palette.caution : palette.fgDim;
  return (
    <Text testID={testID} style={[styles.hint, { color }]}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({ hint: { fontSize: TEXT_SIZE.small, lineHeight: 20 } });
