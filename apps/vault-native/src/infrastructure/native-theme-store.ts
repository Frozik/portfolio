import type { IThemeStore } from '@frozik/vault-app/device/domain/ports/theme-store';
import type { TThemePreference } from '@frozik/vault-app/device/domain/theme';
import { Storage } from 'expo-sqlite/kv-store';
import { Appearance } from 'react-native';

const THEME_KEY = 'vault:theme';
const PREFERENCES: readonly TThemePreference[] = ['system', 'light', 'dark'];

function isPreference(value: string | null): value is TThemePreference {
  return PREFERENCES.some(preference => preference === value);
}

/** The choice in the app's settings store, read before any key: the start and unlock screens paint with it. */
export const NATIVE_THEME_STORE: IThemeStore = {
  read() {
    const stored = Storage.getItemSync(THEME_KEY);
    return isPreference(stored) ? stored : 'system';
  },
  write(preference) {
    Storage.setItemSync(THEME_KEY, preference);
    return true;
  },
  systemIsDark: () => Appearance.getColorScheme() === 'dark',
  onSystemChange(listener) {
    const subscription = Appearance.addChangeListener(({ colorScheme }) =>
      listener(colorScheme === 'dark')
    );
    return () => subscription.remove();
  },
};
