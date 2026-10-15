import { makeAutoObservable } from 'mobx';

import type { IThemeStore } from '../domain/ports/theme-store';
import type { TColorScheme, TThemePreference } from '../domain/theme';
import { resolveScheme } from '../domain/theme';

/** The theme this device chose, and the scheme it paints with now. */
export class AppearanceModel {
  preference: TThemePreference;
  systemIsDark: boolean;
  /** The last choice could not be kept on this device (site data blocked): it lasts while the app runs. */
  notRemembered = false;

  private readonly stopFollowingSystem: () => void;

  constructor(private readonly store: IThemeStore) {
    this.preference = store.read();
    this.systemIsDark = store.systemIsDark();
    makeAutoObservable<AppearanceModel, 'store' | 'stopFollowingSystem'>(
      this,
      { store: false, stopFollowingSystem: false },
      { autoBind: true }
    );
    this.stopFollowingSystem = store.onSystemChange(this.systemChanged);
  }

  get scheme(): TColorScheme {
    return resolveScheme(this.preference, this.systemIsDark);
  }

  choose(preference: TThemePreference): void {
    this.preference = preference;
    this.notRemembered = !this.store.write(preference);
  }

  dispose(): void {
    this.stopFollowingSystem();
  }

  private systemChanged(dark: boolean): void {
    this.systemIsDark = dark;
  }
}
