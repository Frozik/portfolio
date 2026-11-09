import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { TGroupId } from '../contexts/grouping/domain/group';
import { findGroup } from '../contexts/grouping/domain/group-book';
import { useTexts } from '../texts/use-texts';
import { useApp } from './AppContext';
import { groupName } from './group-name';
import { GUTTER, RADIUS, TEXT_SIZE, TOUCH_SIZE } from './kit/metrics';
import { usePalette } from './theme/AppTheme';

const VISIBLE_MS = 6_000;
const TAB_BAR_CLEARANCE = 64;

/** «Moved to Delivery · excluded from Spam · Undo»: every edit says what it changed. */
export const ChangeSnackbar = observer(function ChangeSnackbar() {
  const app = useApp();
  const texts = useTexts();
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const change = app.books.lastChange;
  const [hidden, setHidden] = useState<number | null>(null);
  useEffect(() => {
    if (change === null) {
      return undefined;
    }
    const timer = setTimeout(() => setHidden(change.id), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [change]);
  if (change === null || hidden === change.id) {
    return null;
  }
  const name = (id: string) => {
    const group = findGroup(app.books.book, id as TGroupId);
    return group === null ? '' : groupName(texts, group);
  };
  const message = [
    ...new Set(
      change.events.map(event => texts.changes.event(event, name)).filter(text => text !== null)
    ),
  ].join(' · ');
  if (message === '') {
    return null;
  }
  return (
    <View
      testID="change-snackbar"
      style={[
        styles.bar,
        { backgroundColor: palette.fg, bottom: insets.bottom + TAB_BAR_CLEARANCE },
      ]}
    >
      <Text style={[styles.text, { color: palette.bg }]} numberOfLines={3}>
        {message}
      </Text>
      {app.books.canUndo ? (
        <Pressable
          testID="change-undo"
          accessibilityRole="button"
          onPress={() => app.books.undo()}
          style={styles.undo}
        >
          <Text style={[styles.undoText, { color: palette.accentSoft }]}>{texts.common.undo}</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: GUTTER,
    right: GUTTER,
    borderRadius: RADIUS,
    paddingLeft: GUTTER,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: TOUCH_SIZE,
  },
  text: { flex: 1, fontSize: TEXT_SIZE.small, paddingVertical: 10 },
  undo: { minHeight: TOUCH_SIZE, paddingHorizontal: GUTTER, justifyContent: 'center' },
  undoText: { fontSize: TEXT_SIZE.small, fontWeight: '700' },
});
