import type { TThemePreference } from '../theme';

/**
 * Where this device keeps its theme choice — in the open, since the start and
 * unlock screens paint before any key — and what the system prefers.
 */
export interface IThemeStore {
  read(): TThemePreference;
  /** `false` when the platform refused to keep it: it then lasts while the app runs. */
  write(preference: TThemePreference): boolean;
  systemIsDark(): boolean;
  onSystemChange(listener: (dark: boolean) => void): () => void;
}
