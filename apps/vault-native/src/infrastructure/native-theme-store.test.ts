import { Appearance } from 'react-native';

import { NATIVE_THEME_STORE } from './native-theme-store';

jest.mock('expo-sqlite/kv-store', () => {
  const items = new Map<string, string>();
  return {
    Storage: {
      setItemSync: (key: string, value: string) => items.set(key, value),
      getItemSync: (key: string) => items.get(key) ?? null,
    },
  };
});

describe('the phone’s theme store', () => {
  it('follows the system until a choice is kept, then gives that choice back', () => {
    const before = NATIVE_THEME_STORE.read();

    NATIVE_THEME_STORE.write('dark');

    expect([before, NATIVE_THEME_STORE.read()]).toEqual(['system', 'dark']);
  });

  it('reports the system switching to dark', () => {
    let changeScheme: (preferences: Appearance.AppearancePreferences) => void = () => undefined;
    jest.spyOn(Appearance, 'addChangeListener').mockImplementation(listener => {
      changeScheme = listener;
      return { remove: jest.fn() };
    });
    const dark: boolean[] = [];

    NATIVE_THEME_STORE.onSystemChange(isDark => dark.push(isDark));
    changeScheme({ colorScheme: 'dark' });

    expect(dark).toEqual([true]);
  });
});
