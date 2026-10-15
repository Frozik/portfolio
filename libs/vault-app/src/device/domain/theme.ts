/** What the user chose on this device; `system` follows the operating system. */
export type TThemePreference = 'system' | 'light' | 'dark';

export type TColorScheme = 'light' | 'dark';

export function resolveScheme(preference: TThemePreference, systemIsDark: boolean): TColorScheme {
  if (preference !== 'system') {
    return preference;
  }
  return systemIsDark ? 'dark' : 'light';
}
