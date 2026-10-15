import type { IThemeStore } from '@frozik/vault-app/device/domain/ports/theme-store';
import type { TThemePreference } from '@frozik/vault-app/device/domain/theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';
const PREFERENCES: readonly TThemePreference[] = ['system', 'light', 'dark'];

function isPreference(value: string | null): value is TThemePreference {
  return PREFERENCES.some(preference => preference === value);
}

/**
 * The choice in this origin's `localStorage` under `key`. Site data may be
 * blocked (private windows, strict settings): a read then gives the system's
 * scheme and a write says it was not kept — the choice is a convenience.
 */
export function createLocalThemeStore(key: string): IThemeStore {
  return {
    read() {
      try {
        const stored = localStorage.getItem(key);
        return isPreference(stored) ? stored : 'system';
      } catch {
        return 'system';
      }
    },
    write(preference) {
      try {
        localStorage.setItem(key, preference);
        return true;
      } catch {
        return false;
      }
    },
    systemIsDark: () => window.matchMedia(DARK_QUERY).matches,
    onSystemChange(listener) {
      const query = window.matchMedia(DARK_QUERY);
      const changed = (event: MediaQueryListEvent): void => listener(event.matches);
      query.addEventListener('change', changed);
      return () => query.removeEventListener('change', changed);
    },
  };
}
