import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { GAP, TEXT_SIZE } from '../kit/metrics';
import { usePalette } from '../theme/AppTheme';

/** One titled group of the settings column. */
export function SettingsGroup({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  const palette = usePalette();
  return (
    <View style={[styles.group, { borderBottomColor: palette.line }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: palette.fg }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: GAP, paddingBottom: 20, borderBottomWidth: 1 },
  title: { fontSize: TEXT_SIZE.heading, fontWeight: '600' },
});
