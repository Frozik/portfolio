import { StyleSheet, Text, View } from 'react-native';

import { useVaultTexts } from './texts';
import { usePalette } from './theme/AppTheme';
import { useAppAway } from './useAppAway';

/**
 * The app switcher keeps a picture of the last frame: while the app is away a
 * brand screen in the current theme covers whatever was open, also when the
 * user allowed screenshots and the system no longer blanks it.
 */
export function PrivacyCurtain() {
  const away = useAppAway();
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
