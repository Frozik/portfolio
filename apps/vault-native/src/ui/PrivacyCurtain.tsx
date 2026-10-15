import { useSyncExternalStore } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';

import { useVaultTexts } from './texts';
import { usePalette } from './theme/AppTheme';

function subscribe(changed: () => void): () => void {
  const subscription = AppState.addEventListener('change', changed);
  return () => subscription.remove();
}

const isAway = (): boolean =>
  AppState.currentState === 'background' || AppState.currentState === 'inactive';

/**
 * The app switcher keeps a picture of the last frame: while the app is away a
 * brand screen in the current theme covers whatever was open, also when the
 * user allowed screenshots and the system no longer blanks it.
 */
export function PrivacyCurtain() {
  const away = useSyncExternalStore(subscribe, isAway);
  const palette = usePalette();
  const t = useVaultTexts().phone;
  if (!away) {
    return null;
  }
  return (
    <View
      testID="privacy-curtain"
      style={[StyleSheet.absoluteFill, styles.curtain, { backgroundColor: palette.bg }]}
    >
      <Text style={{ color: palette.fgDim }}>{t.curtain}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  curtain: { alignItems: 'center', justifyContent: 'center' },
});
