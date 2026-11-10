import { assertNever } from '@frozik/utils/assert/assertNever';
import { computed, makeObservable, observableRef, runInAction } from 'mobx';
import type { Temporal } from 'temporal-polyfill';

import type { IDiagnosticsLog } from '../../diagnostics/domain/ports/diagnostics-log';
import type { IClock } from '../../policy/domain/ports/clock';
import type { ICalendarEvent } from '../domain/calendar-event';
import type { TCalendarSource, TIcsId } from '../domain/calendar-source';
import type { IIcsSubscription } from '../domain/ics-subscription';
import type { ICalendarStore } from '../domain/ports/calendar-store';
import type { IDeviceCalendar, IDeviceCalendars } from '../domain/ports/device-calendars';
import type { IIcsFeed, TIcsFetchFailure } from '../domain/ports/ics-feed';
import type { CalendarInputsModel } from './CalendarInputsModel';

const HOURS_PER_DAY = 24;
/** A device calendar is read live at a call; the copy only covers a month in case it vanishes. */
const DEVICE_COPY_DAYS = 30;
/** iCal copies cover as far as the schedules do. */
const LONG_COPY_DAYS = 400;
/** An iCal link is asked again at most this often. */
const REFRESH_EVERY_MINUTES = 60;

export type TAddResult =
  | { readonly kind: 'added'; readonly id: TIcsId; readonly upcoming: readonly ICalendarEvent[] }
  | { readonly kind: 'failed'; readonly failure: TIcsFetchFailure };

interface ICalendarPorts {
  readonly device: IDeviceCalendars;
  readonly feed: IIcsFeed;
  readonly store: ICalendarStore;
  readonly clock: IClock;
  readonly diagnostics: IDiagnosticsLog;
  readonly inputs: CalendarInputsModel;
  /** The calendars the group book's rules look at. */
  readonly sourcesInUse: () => readonly TCalendarSource[];
  readonly newId: () => string;
  readonly canReadDevice: () => boolean;
}

/** The phone's calendars and the iCal links, copied locally for the ruleset; the network only refreshes. */
export class CalendarsModel {
  deviceCalendars: readonly IDeviceCalendar[] = [];
  subscriptions: readonly IIcsSubscription[] = [];

  constructor(private readonly ports: ICalendarPorts) {
    makeObservable(this, {
      deviceCalendars: observableRef,
      subscriptions: observableRef,
      byAccount: computed,
    });
  }

  get byAccount(): ReadonlyMap<string, readonly IDeviceCalendar[]> {
    const accounts = new Map<string, IDeviceCalendar[]>();
    for (const calendar of this.deviceCalendars) {
      accounts.set(calendar.accountName, [...(accounts.get(calendar.accountName) ?? []), calendar]);
    }
    return accounts;
  }

  async load(): Promise<void> {
    const settings = await this.ports.store.load();
    runInAction(() => {
      this.subscriptions = settings.subscriptions;
    });
  }

  /** Re-reads the device calendars and the copies; the links are fetched only when due, or when forced. */
  async refresh(force = false): Promise<void> {
    if (this.ports.canReadDevice()) {
      const calendars = await this.ports.device.calendars();
      runInAction(() => {
        this.deviceCalendars = calendars;
      });
    }
    await Promise.all(
      this.subscriptions
        .filter(subscription => force || this.isDue(subscription))
        .map(subscription => this.fetch(subscription))
    );
    await this.copyEvents();
  }

  async addSubscription(label: string, url: string): Promise<TAddResult> {
    const fetched = await this.ports.feed.fetch(url, null);
    if (!fetched.ok) {
      this.ports.diagnostics.log('warn', 'ics', 'add-failed', { url, reason: fetched.error.kind });
      return { kind: 'failed', failure: fetched.error };
    }
    if (fetched.value.kind !== 'body') {
      return { kind: 'failed', failure: { kind: 'not-a-calendar' } };
    }
    const now = this.ports.clock.now();
    const subscription: IIcsSubscription = {
      id: this.ports.newId() as TIcsId,
      label,
      url,
      body: fetched.value.body,
      etag: fetched.value.etag,
      refreshedAt: now,
      failedAt: null,
    };
    this.setSubscriptions([...this.subscriptions, subscription]);
    await this.copyEvents();
    const upcoming = this.ports.feed
      .events(fetched.value.body, now, now.add({ hours: LONG_COPY_DAYS * HOURS_PER_DAY }))
      .slice(0, 3);
    return { kind: 'added', id: subscription.id, upcoming };
  }

  removeSubscription(id: TIcsId): void {
    this.setSubscriptions(this.subscriptions.filter(subscription => subscription.id !== id));
  }

  sourceName(source: TCalendarSource): string | null {
    switch (source.kind) {
      case 'device':
        return source.calendarName;
      case 'ics':
        return (
          this.subscriptions.find(subscription => subscription.id === source.id)?.label ?? null
        );
      default:
        return assertNever(source);
    }
  }

  private isDue(subscription: IIcsSubscription): boolean {
    const last = subscription.refreshedAt ?? subscription.failedAt;
    return (
      last === null || this.ports.clock.now().since(last).total('minutes') >= REFRESH_EVERY_MINUTES
    );
  }

  private async fetch(subscription: IIcsSubscription): Promise<void> {
    const fetched = await this.ports.feed.fetch(subscription.url, subscription.etag);
    const now = this.ports.clock.now();
    if (!fetched.ok) {
      const level = fetched.error.kind === 'offline' ? 'info' : 'warn';
      this.ports.diagnostics.log(level, 'ics', 'refresh-failed', {
        url: subscription.url,
        reason: fetched.error.kind,
      });
      this.replace({ ...subscription, failedAt: now });
      return;
    }
    this.ports.diagnostics.log(
      'info',
      'ics',
      fetched.value.kind === 'unchanged' ? 'unchanged' : 'refreshed',
      { url: subscription.url }
    );
    this.replace(
      fetched.value.kind === 'unchanged'
        ? { ...subscription, refreshedAt: now, failedAt: null }
        : {
            ...subscription,
            body: fetched.value.body,
            etag: fetched.value.etag,
            refreshedAt: now,
            failedAt: null,
          }
    );
  }

  private async eventsOf(
    source: TCalendarSource,
    from: Temporal.Instant,
    days: number
  ): Promise<readonly ICalendarEvent[]> {
    const to = from.add({ hours: days * HOURS_PER_DAY });
    switch (source.kind) {
      case 'device': {
        const calendar = this.deviceCalendars.find(
          candidate =>
            candidate.accountType === source.accountType &&
            candidate.accountName === source.accountName &&
            candidate.calendarName === source.calendarName
        );
        return calendar === undefined ? [] : this.ports.device.events(calendar.id, from, to);
      }
      case 'ics': {
        const body =
          this.subscriptions.find(subscription => subscription.id === source.id)?.body ?? null;
        return body === null ? [] : this.ports.feed.events(body, from, to);
      }
      default:
        return assertNever(source);
    }
  }

  /** Copies the events the rules need into the inputs the ruleset reads. */
  private async copyEvents(): Promise<void> {
    const from = this.ports.clock.now().subtract({ hours: HOURS_PER_DAY });
    for (const source of this.ports.sourcesInUse()) {
      const days = source.kind === 'device' ? DEVICE_COPY_DAYS : LONG_COPY_DAYS;
      this.ports.inputs.setEvents(source, await this.eventsOf(source, from, days));
    }
  }

  private replace(subscription: IIcsSubscription): void {
    this.setSubscriptions(
      this.subscriptions.map(existing =>
        existing.id === subscription.id ? subscription : existing
      )
    );
  }

  private setSubscriptions(subscriptions: readonly IIcsSubscription[]): void {
    runInAction(() => {
      this.subscriptions = subscriptions;
    });
    void this.persist();
  }

  private async persist(): Promise<void> {
    await this.ports.store.save({ subscriptions: this.subscriptions });
  }
}
