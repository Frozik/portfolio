import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePalette } from '../theme/AppTheme';
import { GAP, GUTTER, TEXT_SIZE } from './metrics';

/**
 * A full screen edge to edge: the content clears the system bars, the background runs under them.
 * Edge to edge, Android no longer shrinks the window for the keyboard, so the screen gives way itself.
 */
export function Screen({
  title,
  testID,
  back,
  footer,
  children,
}: {
  readonly title: string;
  readonly testID: string;
  /** The way up, above the title. */
  readonly back?: ReactNode;
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
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + GUTTER, paddingBottom: insets.bottom + GUTTER },
        ]}
      >
        {back}
        <Text accessibilityRole="header" style={[styles.title, { color: palette.fg }]}>
          {title}
        </Text>
        {children}
        {footer}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: GUTTER, gap: GAP },
  title: { fontSize: TEXT_SIZE.title, fontWeight: '600' },
});
