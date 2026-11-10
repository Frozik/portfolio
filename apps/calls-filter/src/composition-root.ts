import Constants from 'expo-constants';
import { openDatabaseSync } from 'expo-sqlite';
import { Platform } from 'react-native';

import type { TCountryCode } from './contexts/phone/domain/dialing-region';
import { CallsFilterApp } from './contexts/shell/application/CallsFilterApp';
import { ANDROID_PERMISSIONS } from './infrastructure/android-permissions';
import { openE2eControl } from './infrastructure/e2e-control/e2e-control-channel';
import { expoContactsDirectory } from './infrastructure/expo-contacts-directory';
import { EXPO_CURRENT_POINT } from './infrastructure/expo-current-point';
import { expoDeviceCalendars } from './infrastructure/expo-device-calendars';
import { expoGeofences } from './infrastructure/expo-geofences';
import { GOOGLE_DRIVE_ACCOUNT, googleDriveCloudOf } from './infrastructure/google-drive-sync';
import { ICS_HTTP_FEED } from './infrastructure/ics-http-feed';
import { LIBPHONENUMBER_NUMBERING } from './infrastructure/libphonenumber-numbering';
import { everyMinute } from './infrastructure/minute-ticks';
import { nativeCallHistory } from './infrastructure/native-call-history';
import { nativeCallJournal } from './infrastructure/native-call-journal';
import { NATIVE_CONTACT_VIEWER } from './infrastructure/native-contact-viewer';
import { NATIVE_DIAGNOSTICS_LOG } from './infrastructure/native-diagnostics-log';
import { NATIVE_SCREENING_RUNTIME } from './infrastructure/native-screening-runtime';
import { NATIVE_SYSTEM_SETTINGS } from './infrastructure/native-system-settings';
import { NATIVE_TIME_ZONES } from './infrastructure/native-time-zones';
import { nominatimSearch } from './infrastructure/nominatim-search';
import { loadNumberingCatalogue } from './infrastructure/numbering-catalogue-file';
import { PER_APP_LANGUAGE } from './infrastructure/per-app-language';
import { RRULE_RECURRENCE_EXPANDER } from './infrastructure/rrule-recurrence-expander';
import { shareSheetExport } from './infrastructure/share-sheet-export';
import { sqliteCalendarStore } from './infrastructure/sqlite-calendar-store';
import { sqliteGroupBookRepository } from './infrastructure/sqlite-group-book-repository';
import { sqlitePreferencesStore } from './infrastructure/sqlite-preferences-store';
import { SqliteStore } from './infrastructure/sqlite-store';
import { sqliteSyncStore } from './infrastructure/sqlite-sync-store';
import { SYSTEM_CLOCK } from './infrastructure/system-clock';
import { UUID_IDS } from './infrastructure/uuid-ids';

const DATABASE_NAME = 'calls-filter.db';
/** When neither the SIM nor the phone's language names a country. */
const FALLBACK_HOME = 'US' as TCountryCode;

let running: Promise<CallsFilterApp> | null = null;

/** The one app of this JS runtime: the screens and the background refresh share it. */
export function startApp(): Promise<CallsFilterApp> {
  running ??= wireApp();
  return running;
}

export function stopApp(app: CallsFilterApp): void {
  app.dispose();
  running = null;
}

/** The composition root: the phone's services are wired here and nowhere else. */
function wireApp(): Promise<CallsFilterApp> {
  const store = new SqliteStore(openDatabaseSync(DATABASE_NAME));
  const home = (): TCountryCode =>
    NATIVE_SCREENING_RUNTIME.simCountry() ??
    (PER_APP_LANGUAGE.regionHint() as TCountryCode | null) ??
    FALLBACK_HOME;
  const started = CallsFilterApp.start({
    repository: sqliteGroupBookRepository(store, NATIVE_DIAGNOSTICS_LOG),
    deviceCalendars: expoDeviceCalendars(SYSTEM_CLOCK.timeZone),
    icsFeed: ICS_HTTP_FEED,
    calendarStore: sqliteCalendarStore(store, NATIVE_DIAGNOSTICS_LOG),
    journal: nativeCallJournal(LIBPHONENUMBER_NUMBERING),
    history: nativeCallHistory(LIBPHONENUMBER_NUMBERING, home),
    contactViewer: NATIVE_CONTACT_VIEWER,
    timeZones: NATIVE_TIME_ZONES,
    openSettings: NATIVE_SYSTEM_SETTINGS,
    cloudOf: googleDriveCloudOf,
    syncStore: sqliteSyncStore(store, NATIVE_DIAGNOSTICS_LOG),
    googleAccount: GOOGLE_DRIVE_ACCOUNT,
    geofences: expoGeofences(NATIVE_DIAGNOSTICS_LOG),
    searchAddress: nominatimSearch(() => PER_APP_LANGUAGE.resolved()),
    currentPoint: EXPO_CURRENT_POINT,
    runtime: NATIVE_SCREENING_RUNTIME,
    numbering: LIBPHONENUMBER_NUMBERING,
    numberingCatalogue: loadNumberingCatalogue,
    expander: RRULE_RECURRENCE_EXPANDER,
    appLanguage: PER_APP_LANGUAGE,
    preferences: sqlitePreferencesStore(store, NATIVE_DIAGNOSTICS_LOG),
    permissions: ANDROID_PERMISSIONS,
    contacts: expoContactsDirectory(LIBPHONENUMBER_NUMBERING, home),
    diagnostics: NATIVE_DIAGNOSTICS_LOG,
    share: shareSheetExport,
    clock: SYSTEM_CLOCK,
    everyMinute,
    newId: UUID_IDS,
    exportHeader: () => ({
      appVersion: Constants.expoConfig?.version ?? 'dev',
      androidVersion: String(Platform.Version),
      device:
        Platform.OS === 'android'
          ? `${Platform.constants.Manufacturer} ${Platform.constants.Model}`
          : Platform.OS,
      facts: {},
    }),
    smsReply: Constants.expoConfig?.extra?.smsReply !== false,
  });
  // A no-op outside the APK built for the e2e tests: the native side keeps the channel shut.
  return started.then(app => {
    openE2eControl(app);
    return app;
  });
}
