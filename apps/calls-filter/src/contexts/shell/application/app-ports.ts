import type { ICalendarStore } from '../../calendars/domain/ports/calendar-store';
import type { IDeviceCalendars } from '../../calendars/domain/ports/device-calendars';
import type { IIcsFeed } from '../../calendars/domain/ports/ics-feed';
import type { IAppLanguage } from '../../device/domain/ports/app-language';
import type { IContactViewer } from '../../device/domain/ports/contact-viewer';
import type { IPermissions } from '../../device/domain/ports/permissions';
import type { IPreferencesStore } from '../../device/domain/ports/preferences-store';
import type { TOpenSystemSettings } from '../../device/domain/ports/system-settings';
import type { IExportHeader } from '../../diagnostics/domain/export-file';
import type { IDiagnosticsLog } from '../../diagnostics/domain/ports/diagnostics-log';
import type { TShareFile } from '../../diagnostics/domain/ports/file-share';
import type { IContactsDirectory } from '../../grouping/domain/ports/contacts-directory';
import type { IGroupBookRepository } from '../../grouping/domain/ports/group-book-repository';
import type { TNewId } from '../../grouping/domain/ports/id-source';
import type { ICallHistory } from '../../journal/domain/ports/call-history';
import type { ICallJournal } from '../../journal/domain/ports/call-journal';
import type { TLoadNumberingCatalogue } from '../../phone/domain/ports/numbering-catalogue';
import type { IPhoneNumbering } from '../../phone/domain/ports/phone-numbering';
import type {
  IGeofences,
  TCurrentPoint,
  TSearchAddress,
} from '../../places/domain/ports/geofences';
import type { IClock } from '../../policy/domain/ports/clock';
import type { TListTimeZones } from '../../policy/domain/ports/time-zones';
import type { IRecurrenceExpander } from '../../policy/domain/recurrence-expander';
import type { IScreeningRuntime } from '../../screening/domain/ports/screening-runtime';
import type { ICloudCopy } from '../../sync/domain/ports/cloud-copy';
import type { IGoogleAccount } from '../../sync/domain/ports/google-account';
import type { ISyncStore } from '../../sync/domain/ports/sync-store';

/** Everything the app needs from the phone and the world, wired in the composition root. */
export interface IAppPorts {
  readonly geofences: IGeofences;
  readonly searchAddress: TSearchAddress;
  readonly currentPoint: TCurrentPoint;
  readonly repository: IGroupBookRepository;
  readonly deviceCalendars: IDeviceCalendars;
  readonly icsFeed: IIcsFeed;
  readonly calendarStore: ICalendarStore;
  readonly journal: ICallJournal;
  readonly history: ICallHistory;
  readonly timeZones: TListTimeZones;
  readonly openSettings: TOpenSystemSettings;
  readonly cloudOf: (account: string | null) => ICloudCopy;
  readonly syncStore: ISyncStore;
  readonly googleAccount: IGoogleAccount;
  readonly contactViewer: IContactViewer;
  readonly runtime: IScreeningRuntime;
  readonly numbering: IPhoneNumbering;
  readonly numberingCatalogue: TLoadNumberingCatalogue;
  readonly expander: IRecurrenceExpander;
  readonly appLanguage: IAppLanguage;
  readonly preferences: IPreferencesStore;
  readonly permissions: IPermissions;
  readonly contacts: IContactsDirectory;
  readonly diagnostics: IDiagnosticsLog;
  readonly share: TShareFile;
  readonly clock: IClock;
  /** Calls `tick` once a minute until stopped: what depends on the time of day moves on with it. */
  readonly everyMinute: (tick: () => void) => () => void;
  readonly newId: TNewId;
  readonly exportHeader: () => IExportHeader;
  /** This build may send an SMS: the edition without SMS declares no such permission. */
  readonly smsReply: boolean;
}
