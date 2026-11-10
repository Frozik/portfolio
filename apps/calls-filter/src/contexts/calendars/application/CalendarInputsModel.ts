import { assertNever } from '@frozik/utils/assert/assertNever';
import { computed, makeObservable, observableRef, runInAction } from 'mobx';

import type { ICalendarRule } from '../../policy/domain/policy';
import type { TWindowSet } from '../../policy/domain/window-set';
import type { ICalendarInputs } from '../../screening/application/screening-inputs-builder';
import type { ICalendarEvent } from '../domain/calendar-event';
import type { TCalendarSource } from '../domain/calendar-source';
import { eventWindows } from '../domain/event-windows';

function sourceKey(source: TCalendarSource): string {
  switch (source.kind) {
    case 'device':
      return `device:${source.accountType}:${source.accountName}:${source.calendarName}`;
    case 'ics':
      return `ics:${source.id}`;
    default:
      return assertNever(source);
  }
}

/**
 * The events already on the phone, for the ruleset and the editors: the
 * calendars context fills it from the device provider and the iCal copies; nothing here
 * waits on the network.
 */
export class CalendarInputsModel implements ICalendarInputs {
  private events: ReadonlyMap<string, readonly ICalendarEvent[]> = new Map();

  constructor(private readonly zone: () => string) {
    makeObservable<CalendarInputsModel, 'events'>(this, {
      events: observableRef,
      version: computed,
    });
  }

  /** Changes whenever anything the ruleset reads from calendars changes. */
  get version(): readonly unknown[] {
    return [this.events];
  }

  eventsOf(rule: ICalendarRule): TWindowSet {
    return eventWindows(this.events.get(sourceKey(rule.source)) ?? [], rule.filter, this.zone());
  }

  eventsFor(source: TCalendarSource): readonly ICalendarEvent[] {
    return this.events.get(sourceKey(source)) ?? [];
  }

  setEvents(source: TCalendarSource, events: readonly ICalendarEvent[]): void {
    runInAction(() => {
      this.events = new Map([...this.events, [sourceKey(source), events]]);
    });
  }
}
