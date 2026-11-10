import { StyleSheet, Text } from 'react-native';

import { usePalette } from '../theme/AppTheme';
import { TEXT_SIZE } from './metrics';

/** The small capitals over a block of a screen. */
export function SectionTitle({ title }: { readonly title: string }) {
  const palette = usePalette();
  return <Text style={[styles.title, { color: palette.fgDim }]}>{title.toUpperCase()}</Text>;
}

const styles = StyleSheet.create({
  title: { fontSize: TEXT_SIZE.caption, fontWeight: '700', letterSpacing: 0.6 },
});
