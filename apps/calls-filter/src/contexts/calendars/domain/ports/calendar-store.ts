import type { THolidayMap } from '../holiday-map';
import type { IIcsSubscription } from '../ics-subscription';

interface ICalendarSettings {
  readonly subscriptions: readonly IIcsSubscription[];
  readonly holidays: THolidayMap;
}

/** The iCal links with their copies, and which calendar holds whose holidays: this phone only. */
export interface ICalendarStore {
  load(): Promise<ICalendarSettings>;
  save(settings: ICalendarSettings): Promise<void>;
}
