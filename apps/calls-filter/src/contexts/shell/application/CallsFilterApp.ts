import { uniqBy } from 'lodash-es';
import { computed, makeObservable, observableRef, reaction, runInAction } from 'mobx';

import { CalendarInputsModel } from '../../calendars/application/CalendarInputsModel';
import { CalendarsModel } from '../../calendars/application/CalendarsModel';
import { DeviceModel } from '../../device/application/DeviceModel';
import { PermissionPrompt } from '../../device/application/PermissionPrompt';
import type { TSettingsPlace } from '../../device/domain/ports/system-settings';
import { DiagnosticsModel } from '../../diagnostics/application/DiagnosticsModel';
import { GroupBookStore } from '../../grouping/application/GroupBookStore';
import { calendarSourcesOf } from '../../grouping/domain/calendar-sources';
import type { IConflictFacts } from '../../grouping/domain/conflict-detection';
import type { TGroup, TGroupId } from '../../grouping/domain/group';
import { findGroup } from '../../grouping/domain/group-book';
import { initialBook } from '../../grouping/domain/initial-book';
import type { IMatchingEnvironment } from '../../grouping/domain/matching-environment';
import type { IPickedContact } from '../../grouping/domain/ports/contacts-directory';
import { CallsStore } from '../../journal/application/CallsStore';
import { NumberingCatalogue } from '../../phone/application/NumberingCatalogue';
import type { ICaller } from '../../phone/domain/caller';
import type { IDialingRegion, TCountryCode } from '../../phone/domain/dialing-region';
import type { IPhoneNumbering } from '../../phone/domain/ports/phone-numbering';
import { PlacesModel } from '../../places/application/PlacesModel';
import { floatingMinute } from '../../policy/domain/floating-time';
import type { IGroupStatus } from '../../policy/domain/group-status';
import { groupStatus } from '../../policy/domain/group-status';
import type { IPlaceRule, TPlaceId } from '../../policy/domain/place-rule';
import type { IClock } from '../../policy/domain/ports/clock';
import type { ITimeZone } from '../../policy/domain/ports/time-zones';
import type { IRecurrenceExpander } from '../../policy/domain/recurrence-expander';
import type { INumberQuery, TNumberCheck } from '../../screening/application/number-check';
import { checkNumber } from '../../screening/application/number-check';
import { publishRulesets } from '../../screening/application/RulesetPublisher';
import { screeningInputs } from '../../screening/application/screening-inputs-builder';
import type { IWhereToChoice } from '../../screening/domain/compiled-ruleset';
import { groupWindows } from '../../screening/domain/group-windows';
import type { IScreeningInputs } from '../../screening/domain/screening-inputs';
import { SyncModel } from '../../sync/application/SyncModel';
import type { IAppPorts } from './app-ports';
import { dropReleasedTemporaries } from './released-temporaries';

/** When nothing says where the phone is from: a numbering plan to read national masks by. */
const FALLBACK_COUNTRY = 'US' as TCountryCode;

/** The composition point of the contexts: their models meet here and nowhere else. */
export class CallsFilterApp {
  readonly device: DeviceModel;
  readonly calendarInputs: CalendarInputsModel;
  readonly calendars: CalendarsModel;
  readonly books: GroupBookStore;
  readonly calls: CallsStore;
  readonly diagnostics: DiagnosticsModel;
  readonly permissionPrompt: PermissionPrompt;
  readonly sync: SyncModel;
  readonly places: PlacesModel;
  readonly numberingCatalogue: NumberingCatalogue;
  /** This build may send an SMS: the edition without SMS neither offers the reply nor asks for it. */
  readonly smsReply: boolean;
  contactCallers: readonly ICaller[] = [];
  private minutesPassed = 0;
  private readonly stops: (() => void)[] = [];

  private constructor(
    private readonly ports: IAppPorts,
    book: Parameters<GroupBookStore['replace']>[0]
  ) {
    this.device = new DeviceModel(
      ports.runtime,
      ports.appLanguage,
      ports.preferences,
      ports.permissions,
      ports.clock,
      ports.diagnostics
    );
    this.calendarInputs = new CalendarInputsModel(() => ports.clock.timeZone());
    this.calendars = new CalendarsModel({
      device: ports.deviceCalendars,
      feed: ports.icsFeed,
      store: ports.calendarStore,
      clock: ports.clock,
      diagnostics: ports.diagnostics,
      inputs: this.calendarInputs,
      sourcesInUse: () => calendarSourcesOf(this.books.book),
      newId: ports.newId,
      canReadDevice: () => this.device.permissions.calendar === 'granted',
    });
    this.books = new GroupBookStore(book, ports.clock, ports.newId, () => this.facts);
    this.calls = new CallsStore(
      ports.journal,
      ports.history,
      ports.clock,
      () => this.device.preferences.journalDays,
      () => this.books.book,
      () => this.environment
    );
    this.permissionPrompt = new PermissionPrompt(
      this.device,
      () => ({
        usesDeviceCalendars: this.books.book.groups.some(
          group =>
            group.policy.scheduled?.calendars.some(rule => rule.source.kind === 'device') ?? false
        ),
        usesAutoReply:
          ports.smsReply && this.books.book.groups.some(group => group.autoReply !== null),
        usesPlaces: this.placeRules.length > 0,
      }),
      ports.openSettings
    );
    this.places = new PlacesModel(
      {
        geofences: ports.geofences,
        searchAddress: ports.searchAddress,
        currentPoint: ports.currentPoint,
        diagnostics: ports.diagnostics,
      },
      () => this.placeRules,
      () => this.device.permissions['background-location'] === 'granted'
    );
    this.numberingCatalogue = new NumberingCatalogue(ports.numberingCatalogue, ports.diagnostics);
    this.smsReply = ports.smsReply;
    this.sync = new SyncModel(
      {
        cloudOf: ports.cloudOf,
        store: ports.syncStore,
        google: ports.googleAccount,
        clock: ports.clock,
        diagnostics: ports.diagnostics,
      },
      { book: () => this.books.book, replace: book => this.books.replace(book) }
    );
    this.diagnostics = new DiagnosticsModel(
      ports.diagnostics,
      ports.share,
      ports.clock,
      ports.exportHeader
    );
    makeObservable<CallsFilterApp, 'home' | 'minutesPassed'>(this, {
      contactCallers: observableRef,
      minutesPassed: observableRef,
      home: computed,
      environment: computed,
      facts: computed,
      inputs: computed,
      whereTo: computed,
      timeZones: computed,
    });
  }

  /** Starts the app; how long each step took goes to diagnostics, where a slow start shows. */
  static async start(ports: IAppPorts): Promise<CallsFilterApp> {
    const timings: Record<string, string> = {};
    const timed = async <T>(step: string, work: () => Promise<T> | T): Promise<T> => {
      const from = ports.clock.now().epochMilliseconds;
      const result = await work();
      timings[step] = String(ports.clock.now().epochMilliseconds - from);
      return result;
    };
    const stored = await timed('book', () => ports.repository.load());
    const app = await timed(
      'models',
      () => new CallsFilterApp(ports, stored ?? initialBook(ports.clock.now()))
    );
    await timed('device', () => app.device.load());
    await timed('calendars', () => app.calendars.load());
    await timed('sync', () => app.sync.load());
    await timed('begin', () => app.begin());
    ports.diagnostics.log('info', 'app', 'started', {
      groups: String(app.books.book.groups.length),
      ...timings,
    });
    return app;
  }

  get numbering(): IPhoneNumbering {
    return this.ports.numbering;
  }

  get clock(): IClock {
    return this.ports.clock;
  }

  get expander(): IRecurrenceExpander {
    return this.ports.expander;
  }

  openContact(contactId: string): void {
    this.ports.contactViewer.open(contactId);
  }

  /** Every zone a schedule can be on, named in the app's language. */
  get timeZones(): readonly ITimeZone[] {
    void this.device.language;
    return this.ports.timeZones();
  }

  /** The city a zone is named after, for phrases like «09:00–18:00 (Helsinki time)». */
  zoneCity(id: string): string {
    return (
      this.timeZones.find(zone => zone.id === id)?.city ??
      id.slice(id.lastIndexOf('/') + 1).replaceAll('_', ' ')
    );
  }

  contactPhotoUri(contactId: string): string {
    return this.ports.contactViewer.photoUri(contactId);
  }

  /** The system picker; a picker that fails is written to diagnostics, never dropped in silence. */
  async pickContact(): Promise<IPickedContact | null> {
    try {
      const picked = await this.ports.contacts.pick();
      this.ports.diagnostics.log(
        'info',
        'permissions',
        picked === null ? 'contact-pick-cancelled' : 'contact-picked',
        {
          phones: String(picked?.phones.length ?? 0),
        }
      );
      return picked;
    } catch (error: unknown) {
      this.ports.diagnostics.log('error', 'permissions', 'contact-picker-failed', {
        error: String(error),
      });
      return null;
    }
  }

  openSettings(place: TSettingsPlace): void {
    this.ports.openSettings(place);
  }

  newPlaceId(): TPlaceId {
    return this.ports.newId() as TPlaceId;
  }

  newGroupId(): TGroupId {
    return this.ports.newId() as TGroupId;
  }

  dismissWhereTo(): void {
    this.ports.runtime.dismissWhereTo();
  }

  private get home(): IDialingRegion {
    const { numbering, appLanguage } = this.ports;
    const country =
      this.device.simCountry ??
      (appLanguage.regionHint() as TCountryCode | null) ??
      FALLBACK_COUNTRY;
    return (
      numbering.region(country) ??
      numbering.region(FALLBACK_COUNTRY) ?? { country, callingCode: '1', nationalPrefix: '1' }
    );
  }

  get environment(): IMatchingEnvironment {
    return { home: this.home, networkCountry: this.device.networkCountry };
  }

  get facts(): IConflictFacts {
    const fromJournal = this.calls.entries.map(entry => entry.caller);
    const knownCallers = uniqBy(
      [...fromJournal, ...this.contactCallers],
      caller =>
        `${caller.number ?? ''}|${caller.networkName ?? ''}|${caller.contact?.lookupKey ?? ''}`
    );
    return { environment: this.environment, knownCallers };
  }

  /** The windows' inputs as of today: what the published ruleset and the screens both read. */
  get inputs(): IScreeningInputs {
    void this.calendarInputs.version;
    return screeningInputs(
      this.ports.clock.localNow().toPlainDate(),
      this.device.timeZone,
      this.ports.expander,
      this.calendarInputs
    );
  }

  /** Every place a group's rules look at. */
  private get placeRules(): readonly IPlaceRule[] {
    return this.books.book.groups.flatMap(group => group.policy.scheduled?.places ?? []);
  }

  /** The groups the shade offers for a stranger's number after the call, as the move sheet ranks them. */
  get whereTo(): readonly IWhereToChoice[] {
    if (!this.device.preferences.askWhereToAfterCall) {
      return [];
    }
    return this.calls.frequentTargets.flatMap(id => {
      const group = findGroup(this.books.book, id);
      return group?.kind === 'custom' ? [{ id, name: group.name }] : [];
    });
  }

  /** What a group does with a call right now, and what it does after that changes; re-read each minute. */
  statusOf(group: TGroup): IGroupStatus {
    void this.minutesPassed;
    const { clock } = this.ports;
    return groupStatus(
      group,
      { instant: clock.now(), local: floatingMinute(clock.localNow()) },
      groupWindows(group.policy, this.inputs),
      place => this.places.atPlace(place)
    );
  }

  /** What the service would answer this caller now: «Check a number». */
  check(query: INumberQuery): TNumberCheck {
    const { clock, numbering } = this.ports;
    return checkNumber(query, {
      book: this.books.book,
      environment: this.environment,
      inputs: this.inputs,
      paused: this.device.isPaused,
      repeatPass: this.device.preferences.repeatPass,
      atPlace: place => this.places.atPlace(place),
      moment: { instant: clock.now(), local: floatingMinute(clock.localNow()) },
      numbering,
      knownCallers: this.facts.knownCallers,
      journal: this.calls.entries,
    });
  }

  /** When the app comes to the front: what the phone may have changed meanwhile. */
  async foreground(): Promise<void> {
    this.device.refresh();
    void this.calls.refresh();
    this.diagnostics.refresh();
    void this.places.settle();
    dropReleasedTemporaries(this.books, this.ports.runtime.releasedTemporaries());
    void this.calendars.refresh();
    void this.sync.syncNow();
    if (this.device.permissions.contacts === 'granted') {
      const callers = await this.ports.contacts.callers();
      runInAction(() => {
        this.contactCallers = callers;
      });
    }
  }

  /** A wake-up from Android while the app is closed: re-read the calendars, the rules follow. */
  async refreshInBackground(): Promise<void> {
    this.device.refresh();
    dropReleasedTemporaries(this.books, this.ports.runtime.releasedTemporaries());
    await this.calendars.refresh();
    await this.sync.syncNow();
  }

  dispose(): void {
    for (const stop of this.stops.splice(0)) {
      stop();
    }
  }

  private begin(): void {
    const { ports } = this;
    this.stops.push(
      this.calls.follow(),
      this.sync.follow(),
      this.places.follow(),
      this.calendars.follow(),
      ports.everyMinute(() =>
        runInAction(() => {
          this.minutesPassed += 1;
        })
      ),
      reaction(
        () => this.books.book,
        book => {
          void ports.repository.save(book);
        }
      ),
      publishRulesets(
        () => ({
          book: this.books.book,
          environment: this.environment,
          inputs: this.inputs,
          whereTo: this.whereTo,
          repeatPass: this.device.preferences.repeatPass,
        }),
        ports.runtime,
        ports.clock,
        ports.diagnostics
      )
    );
    void this.foreground();
    void this.numberingCatalogue.open();
  }
}
