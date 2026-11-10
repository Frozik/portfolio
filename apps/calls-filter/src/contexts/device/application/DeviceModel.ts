import type { Language } from '@frozik/utils/i18n/language';
import { action, computed, makeObservable, observable, observableRef, runInAction } from 'mobx';
import type { Temporal } from 'temporal-polyfill';

import type { IDiagnosticsLog } from '../../diagnostics/domain/ports/diagnostics-log';
import type { TCountryCode } from '../../phone/domain/dialing-region';
import type { IClock } from '../../policy/domain/ports/clock';
import type { TRepeatPass } from '../../policy/domain/repeat-pass';
import type { IScreeningRuntime } from '../../screening/domain/ports/screening-runtime';
import type { IAppLanguage } from '../domain/ports/app-language';
import type { IPermissions, TPermission, TPermissionState } from '../domain/ports/permissions';
import type { IPreferencesStore } from '../domain/ports/preferences-store';
import type { IDevicePreferences, TLanguageChoice, TThemeChoice } from '../domain/preferences';
import { DEFAULT_PREFERENCES } from '../domain/preferences';

const PERMISSIONS: readonly TPermission[] = [
  'contacts',
  'calendar',
  'call-log',
  'notifications',
  'phone-state',
  'sms',
  'location',
  'background-location',
];

/** What is true of this phone: language, theme, the pause, the screening role and the permissions. */
export class DeviceModel {
  preferences: IDevicePreferences = DEFAULT_PREFERENCES;
  languageChoice: TLanguageChoice;
  language: Language;
  pausedUntil: Temporal.Instant | null;
  holdsRole: boolean;
  networkCountry: TCountryCode | null;
  /** The phone's zone, so schedules on another zone's clock follow a trip. */
  timeZone: string;
  simCountry: TCountryCode | null;
  permissions: Readonly<Record<TPermission, TPermissionState>> = {
    contacts: 'ask',
    calendar: 'ask',
    'call-log': 'ask',
    notifications: 'ask',
    'phone-state': 'ask',
    sms: 'ask',
    location: 'ask',
    'background-location': 'ask',
  };

  constructor(
    private readonly runtime: IScreeningRuntime,
    private readonly appLanguage: IAppLanguage,
    private readonly store: IPreferencesStore,
    private readonly permissionsPort: IPermissions,
    private readonly clock: IClock,
    private readonly diagnostics: IDiagnosticsLog
  ) {
    this.languageChoice = appLanguage.choice();
    this.language = appLanguage.resolved();
    this.pausedUntil = runtime.pausedUntil();
    this.holdsRole = runtime.holdsScreeningRole();
    this.networkCountry = runtime.networkCountry();
    this.timeZone = clock.timeZone();
    this.simCountry = runtime.simCountry();
    makeObservable(this, {
      preferences: observableRef,
      languageChoice: observableRef,
      language: observable,
      pausedUntil: observableRef,
      holdsRole: observable,
      networkCountry: observable,
      timeZone: observable,
      simCountry: observable,
      permissions: observableRef,
      isPaused: computed,
      setLanguage: action,
      setTheme: action,
      pause: action,
      resume: action,
      refresh: action,
    });
  }

  get isPaused(): boolean {
    return (
      this.pausedUntil !== null &&
      this.pausedUntil.epochMilliseconds > this.clock.now().epochMilliseconds
    );
  }

  async load(): Promise<void> {
    const preferences = await this.store.load();
    runInAction(() => {
      this.preferences = preferences;
    });
    // The service keeps its own copy of the term: it trims its journal while the app is closed.
    this.runtime.setRetentionDays(preferences.journalDays);
    await this.refreshPermissions();
  }

  /** What the phone may have changed while the app was away: called when it comes to the front. */
  refresh(): void {
    this.pausedUntil = this.runtime.pausedUntil();
    this.holdsRole = this.runtime.holdsScreeningRole();
    this.networkCountry = this.runtime.networkCountry();
    this.timeZone = this.clock.timeZone();
    this.simCountry = this.runtime.simCountry();
    this.language = this.appLanguage.resolved();
    void this.refreshPermissions();
  }

  setLanguage(choice: TLanguageChoice): void {
    this.appLanguage.setChoice(choice);
    this.languageChoice = choice;
    this.language = this.appLanguage.resolved();
  }

  setTheme(theme: TThemeChoice): void {
    this.updatePreferences({ ...this.preferences, theme });
  }

  /** How long the call log is kept: the lists show that far back, and the service keeps that much. */
  setJournalDays(days: number): void {
    this.updatePreferences({ ...this.preferences, journalDays: days });
    this.runtime.setRetentionDays(days);
  }

  setAskWhereTo(ask: boolean): void {
    this.updatePreferences({ ...this.preferences, askWhereToAfterCall: ask });
  }

  setRepeatPass(repeatPass: TRepeatPass): void {
    this.updatePreferences({ ...this.preferences, repeatPass });
    this.diagnostics.log('info', 'app', 'repeat-pass', { kind: repeatPass.kind });
  }

  pause(until: Temporal.Instant): void {
    this.runtime.setPausedUntil(until);
    this.pausedUntil = until;
    this.diagnostics.log('info', 'app', 'paused', { until: until.toString() });
  }

  resume(): void {
    this.runtime.setPausedUntil(null);
    this.pausedUntil = null;
    this.diagnostics.log('info', 'app', 'resumed');
  }

  async requestRole(): Promise<boolean> {
    const held = await this.runtime.requestScreeningRole();
    runInAction(() => {
      this.holdsRole = held;
    });
    this.diagnostics.log(
      held ? 'info' : 'warn',
      'permissions',
      held ? 'role-granted' : 'role-refused'
    );
    return held;
  }

  async request(permission: TPermission): Promise<TPermissionState> {
    const state = await this.permissionsPort.request(permission);
    runInAction(() => {
      this.permissions = { ...this.permissions, [permission]: state };
    });
    this.diagnostics.log('info', 'permissions', `${permission}-${state}`);
    return state;
  }

  private updatePreferences(preferences: IDevicePreferences): void {
    runInAction(() => {
      this.preferences = preferences;
    });
    void this.store.save(preferences);
  }

  private async refreshPermissions(): Promise<void> {
    const states = await Promise.all(
      PERMISSIONS.map(permission => this.permissionsPort.state(permission))
    );
    runInAction(() => {
      this.permissions = Object.fromEntries(
        PERMISSIONS.map((permission, index) => [permission, states[index] ?? 'ask'])
      ) as Record<TPermission, TPermissionState>;
    });
  }
}
