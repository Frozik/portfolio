import type { TCountryCode } from '../../phone/domain/dialing-region';
import type { TCalendarSource } from './calendar-source';

/** Which calendar holds the holidays of which country: «holidays here» reads the one of the network's country. */
export type THolidayMap = ReadonlyMap<TCountryCode, TCalendarSource>;
