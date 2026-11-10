import type { IIcsSubscription } from '../ics-subscription';

interface ICalendarSettings {
  readonly subscriptions: readonly IIcsSubscription[];
}

/** The iCal links with their copies: this phone only. */
export interface ICalendarStore {
  load(): Promise<ICalendarSettings>;
  save(settings: ICalendarSettings): Promise<void>;
}
