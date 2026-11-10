import { err, ok } from '@frozik/utils/result/result';
import { Temporal } from 'temporal-polyfill';

import type { IDevicePreferences } from '../contexts/device/domain/preferences';
import { DEFAULT_PREFERENCES } from '../contexts/device/domain/preferences';
import type { IDiagnosticsEntry } from '../contexts/diagnostics/domain/diagnostics-entry';
import type { GroupBook } from '../contexts/grouping/domain/group-book';
import type { IJournalEntry } from '../contexts/journal/domain/journal-entry';
import type { ICaller } from '../contexts/phone/domain/caller';
import type { TCountryCode } from '../contexts/phone/domain/dialing-region';
import type { INumberingMask } from '../contexts/phone/domain/numbering/gen/numbering-codes';
import type { ICompiledRuleset } from '../contexts/screening/domain/compiled-ruleset';
import type { IAppPorts } from '../contexts/shell/application/app-ports';
import type { ISyncMemory } from '../contexts/sync/domain/ports/sync-store';
import { ICS_HTTP_FEED } from '../infrastructure/ics-http-feed';
import { LIBPHONENUMBER_NUMBERING } from '../infrastructure/libphonenumber-numbering';
import { RRULE_RECURRENCE_EXPANDER } from '../infrastructure/rrule-recurrence-expander';

const PHONE_ZONE = 'Europe/Amsterdam';
/** A Monday morning in Amsterdam: inside working hours, outside the weekend. */
const PHONE_NOW = Temporal.ZonedDateTime.from('2026-11-09T10:00[Europe/Amsterdam]');

const NETHERLANDS = 'NL' as TCountryCode;

export interface IFakePhone {
  readonly ports: IAppPorts;
  /** Every ruleset the app published, newest last. */
  readonly published: ICompiledRuleset[];
  readonly diagnostics: IDiagnosticsEntry[];
  /** The book as the app last saved it. */
  readonly saved: () => GroupBook | null;
  /** This phone's preferences as the app last saved them. */
  readonly preferences: () => IDevicePreferences;
  /** How many days the screening service keeps its journal, as the app last told it. */
  readonly retentionDays: () => number | null;
}

/**
 * A phone of fakes for screen tests: every permission and the screening role granted, a fixed
 * Monday morning in Amsterdam, a Dutch SIM; numbers and recurrences use the real adapters,
 * which need nothing of the device.
 */
export function fakePhone({
  book = null,
  journal = [],
  contacts = [],
  icsFeeds = {},
  numberingCatalogue = [],
  smsReply = true,
}: {
  readonly book?: GroupBook | null;
  readonly journal?: readonly IJournalEntry[];
  readonly contacts?: readonly ICaller[];
  /** iCal links the phone can reach, with what each serves; any other link is offline. */
  readonly icsFeeds?: Readonly<Record<string, string>>;
  /** The masks the phone's numbering catalogue holds; none by default. */
  readonly numberingCatalogue?: readonly INumberingMask[];
  /** False for the edition built without SMS. */
  readonly smsReply?: boolean;
} = {}): IFakePhone {
  let storedBook = book;
  let preferences: IDevicePreferences = DEFAULT_PREFERENCES;
  let syncMemory: ISyncMemory = { connection: null, base: null };
  let nextId = 0;
  let retentionDays: number | null = null;
  const published: ICompiledRuleset[] = [];
  const diagnostics: IDiagnosticsEntry[] = [];
  const ports: IAppPorts = {
    geofences: { watch: async () => {}, settle: async () => {}, atPlace: () => null },
    searchAddress: async () => [],
    currentPoint: async () => null,
    repository: {
      load: async () => storedBook,
      save: async saved => {
        storedBook = saved;
      },
    },
    deviceCalendars: { calendars: async () => [], events: async () => [] },
    icsFeed: {
      fetch: async url => {
        const body = icsFeeds[url];
        return body === undefined
          ? err({ kind: 'offline' })
          : ok({ kind: 'body', body, etag: null });
      },
      events: ICS_HTTP_FEED.events,
    },
    calendarStore: {
      load: async () => ({ subscriptions: [], holidays: new Map() }),
      save: async () => {},
    },
    journal: { since: async () => journal, onChange: () => () => {} },
    history: { since: async () => [] },
    timeZones: () => [
      { id: PHONE_ZONE, city: 'Amsterdam', name: 'Central European Time', offsetMinutes: 60 },
      {
        id: 'Europe/Helsinki',
        city: 'Helsinki',
        name: 'Eastern European Time',
        offsetMinutes: 120,
      },
    ],
    openSettings: () => {},
    cloudOf: () => ({
      read: async () => ({ kind: 'failed', failure: 'offline' }),
      write: async () => ({ kind: 'failed', failure: 'offline' }),
    }),
    syncStore: {
      load: async () => syncMemory,
      save: async memory => {
        syncMemory = memory;
      },
    },
    googleAccount: { connect: async () => ({ kind: 'cancelled' }), disconnect: async () => {} },
    contactViewer: { open: () => {}, photoUri: () => '' },
    runtime: {
      publish: ruleset => {
        published.push(ruleset);
      },
      pausedUntil: () => null,
      setPausedUntil: () => {},
      setRetentionDays: days => {
        retentionDays = days;
      },
      releasedTemporaries: () => [],
      dismissWhereTo: () => {},
      networkCountry: () => NETHERLANDS,
      simCountry: () => NETHERLANDS,
      holdsScreeningRole: () => true,
      requestScreeningRole: async () => true,
    },
    numbering: LIBPHONENUMBER_NUMBERING,
    numberingCatalogue: async () => numberingCatalogue,
    expander: RRULE_RECURRENCE_EXPANDER,
    appLanguage: {
      choice: () => ({ kind: 'system' }),
      setChoice: () => {},
      systemLanguages: () => ['en-NL'],
      resolved: () => 'en',
      regionHint: () => 'NL',
    },
    preferences: {
      load: async () => preferences,
      save: async saved => {
        preferences = saved;
      },
    },
    permissions: { state: async () => 'granted', request: async () => 'granted' },
    contacts: { callers: async () => contacts, pick: async () => null },
    diagnostics: {
      log: (level, category, event, fields = {}) => {
        diagnostics.push({ at: PHONE_NOW.toInstant(), level, category, event, fields });
      },
      latest: limit => diagnostics.slice(-limit).reverse(),
    },
    share: async () => 'shared',
    clock: {
      now: () => PHONE_NOW.toInstant(),
      localNow: () => PHONE_NOW.toPlainDateTime(),
      timeZone: () => PHONE_ZONE,
    },
    newId: () => {
      nextId += 1;
      return `id-${nextId}`;
    },
    exportHeader: () => ({
      appVersion: 'test',
      androidVersion: '16',
      device: 'emulator',
      facts: {},
    }),
    smsReply,
  };
  return {
    ports,
    published,
    diagnostics,
    saved: () => storedBook,
    preferences: () => preferences,
    retentionDays: () => retentionDays,
  };
}
