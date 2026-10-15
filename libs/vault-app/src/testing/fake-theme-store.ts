import type { IThemeStore } from '../device/domain/ports/theme-store';
import type { TThemePreference } from '../device/domain/theme';

/** A device whose system scheme the test switches. */
export function createFakeThemeStore(stored: TThemePreference = 'system', dark = false) {
  let preference = stored;
  let systemIsDark = dark;
  const listeners = new Set<(dark: boolean) => void>();
  const store: IThemeStore = {
    read: () => preference,
    write: next => {
      preference = next;
      return true;
    },
    systemIsDark: () => systemIsDark,
    onSystemChange: listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return {
    store,
    stored: () => preference,
    setSystemDark: (next: boolean) => {
      systemIsDark = next;
      listeners.forEach(listener => listener(next));
    },
    listeners: () => listeners.size,
  };
}
