import { isNil } from 'lodash-es';
import { observer } from 'mobx-react-lite';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Temporal } from 'temporal-polyfill';

import type { ClipboardGuard } from '@frozik/vault-app/exposure/application/ClipboardGuard';

import { GAP, GUTTER, RADIUS, TEXT_SIZE, TOUCH_SIZE } from '../kit/metrics';
import { useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';
import { TAB_BAR_HEIGHT } from './BottomTabs';

const SECOND_MS = 1000;
const ABOVE_TABS_GAP = 8;

/** "Password copied · clears in 30 s" with a live countdown and "Clear now", while the copy waits. */
export const CopySnackbar = observer(function CopySnackbar({
  clipboard,
  label,
  now,
}: {
  readonly clipboard: ClipboardGuard;
  readonly label: string | null;
  readonly now: () => Temporal.Instant;
}) {
  const palette = usePalette();
  const insets = useSafeAreaInsets();
  const t = useVaultTexts().phone;
  const [, setTick] = useState(0);
  const { clearsAt } = clipboard;
  useEffect(() => {
    if (isNil(clearsAt)) {
      return undefined;
    }
    const timer = setInterval(() => setTick(tick => tick + 1), SECOND_MS);
    return () => clearInterval(timer);
  }, [clearsAt]);
  if (isNil(clearsAt) || isNil(label)) {
    return null;
  }
  const seconds = Math.max(0, Math.ceil((clearsAt - now().epochMilliseconds) / SECOND_MS));
  return (
    <View
      testID="copy-snackbar"
      accessibilityLiveRegion="polite"
      style={[
        styles.bar,
        { backgroundColor: palette.fg, bottom: TAB_BAR_HEIGHT + insets.bottom + ABOVE_TABS_GAP },
      ]}
    >
      <Text style={[styles.text, { color: palette.bg }]}>{t.copied(label, seconds)}</Text>
      <Pressable accessibilityRole="button" onPress={clipboard.flush} style={styles.clear}>
        <Text style={[styles.action, { color: palette.bg }]}>{t.clearNow}</Text>
      </Pressable>
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
    gap: GAP,
  },
  text: { flex: 1, fontSize: TEXT_SIZE.small },
  clear: { minHeight: TOUCH_SIZE, paddingHorizontal: GUTTER, justifyContent: 'center' },
  action: { fontSize: TEXT_SIZE.small, fontWeight: '600' },
});
