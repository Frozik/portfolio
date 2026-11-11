import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePalette } from '../theme/AppTheme';
import { GAP, GUTTER, TEXT_SIZE } from './metrics';

/**
 * A full screen edge to edge: the background runs under the system bars, the content clears them —
 * the scrolling area itself starts below the status bar, so text scrolled up never runs under the clock.
 * Edge to edge, Android no longer shrinks the window for the keyboard, so the screen gives way itself.
 */
export function Screen({
  title,
  testID,
  back,
  titleBadge,
  titleEnd,
  footer,
  children,
}: {
  readonly title: string;
  readonly testID: string;
  /** The way up, above the title. */
  readonly back?: ReactNode;
  /** Right after the title, on its line. */
  readonly titleBadge?: ReactNode;
  /** Held to the right edge on the title's line. */
  readonly titleEnd?: ReactNode;
  readonly footer?: ReactNode;
  readonly children: ReactNode;
}) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      testID={testID}
      behavior="padding"
      style={[styles.screen, { backgroundColor: palette.bg }]}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={{ marginTop: insets.top }}
        contentContainerStyle={[
          styles.content,
          { paddingTop: GUTTER, paddingBottom: insets.bottom + GUTTER },
        ]}
      >
        {back}
        <View style={styles.titleLine}>
          <Text accessibilityRole="header" style={[styles.title, { color: palette.fg }]}>
            {title}
          </Text>
          {titleBadge}
          <View style={styles.titleEnd}>{titleEnd}</View>
        </View>
        {children}
        {footer}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: GUTTER, gap: GAP },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: GAP },
  titleEnd: { marginLeft: 'auto' },
  title: { flexShrink: 1, fontSize: TEXT_SIZE.title, fontWeight: '600' },
});
