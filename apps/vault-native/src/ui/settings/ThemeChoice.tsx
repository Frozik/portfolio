import { observer } from 'mobx-react-lite';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { TThemePreference } from '@frozik/vault-app/device/domain/theme';

import { useAppModel } from '../app-model';
import { useVaultTexts } from '../texts';
import { usePalette } from '../theme/AppTheme';

const PREFERENCES: readonly TThemePreference[] = ['system', 'light', 'dark'];
const MIN_TOUCH_SIZE = 48;

/** System · Light · Dark, reachable before unlock and in settings. */
export const ThemeChoice = observer(function ThemeChoice() {
  const { appearance } = useAppModel().app;
  const palette = usePalette();
  const t = useVaultTexts().appearance;
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t.label}
      style={[styles.group, { borderColor: palette.line }]}
    >
      {PREFERENCES.map(preference => {
        const chosen = appearance.preference === preference;
        return (
          <Pressable
            key={preference}
            testID={`theme-${preference}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: chosen }}
            onPress={() => appearance.choose(preference)}
            style={[styles.option, chosen && { backgroundColor: palette.accentSoft }]}
          >
            <Text style={{ color: chosen ? palette.fg : palette.fgDim }}>{t[preference]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  group: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  option: { flex: 1, minHeight: MIN_TOUCH_SIZE, alignItems: 'center', justifyContent: 'center' },
});
