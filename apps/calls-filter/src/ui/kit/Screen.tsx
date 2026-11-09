import type { ReactNode } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePalette } from '../theme/AppTheme';
import { GAP, GUTTER, SMALL_GAP, TEXT_SIZE } from './metrics';

/**
 * A full screen edge to edge: content clears the system bars, the background runs under them.
 * The header stays put while the content scrolls, so «Back» is always in reach.
 */
export function Screen({
  title,
  titleAction,
  testID,
  header,
  footer,
  scroll = true,
  children,
}: {
  readonly title?: string;
  /** An icon button beside the title, such as renaming what the screen shows. */
  readonly titleAction?: ReactNode;
  readonly testID: string;
  readonly header?: ReactNode;
  /** Pinned under the scrolling content: the actions of a long form stay in reach. */
  readonly footer?: ReactNode;
  readonly scroll?: boolean;
  readonly children: ReactNode;
}) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const body = (
    <>
      {title === undefined ? null : (
        <View style={styles.titleLine}>
          <Text style={[styles.title, { color: palette.fg }]}>{title}</Text>
          {titleAction}
        </View>
      )}
      {children}
    </>
  );
  return (
    <KeyboardAvoidingView
      testID={testID}
      behavior="padding"
      style={[styles.screen, { backgroundColor: palette.bg, paddingTop: insets.top }]}
    >
      {header === undefined ? null : (
        <View style={[styles.header, { borderBottomColor: palette.lineSoft }]}>{header}</View>
      )}
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.content,
            { paddingBottom: (footer === undefined ? insets.bottom : 0) + GUTTER },
          ]}
        >
          {body}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fill]}>{body}</View>
      )}
      {footer === undefined ? null : (
        <View
          style={[
            styles.footer,
            { borderTopColor: palette.lineSoft, paddingBottom: insets.bottom + SMALL_GAP },
          ]}
        >
          {footer}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  fill: { flex: 1 },
  content: { padding: GUTTER, gap: GAP },
  footer: {
    paddingHorizontal: GUTTER,
    paddingTop: SMALL_GAP,
    gap: SMALL_GAP,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  header: {
    alignItems: 'flex-start',
    paddingHorizontal: GUTTER,
    paddingTop: SMALL_GAP,
    paddingBottom: SMALL_GAP,
    gap: SMALL_GAP,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: SMALL_GAP },
  title: { flexShrink: 1, fontSize: TEXT_SIZE.title, fontWeight: '700' },
});
