import type { IAvailabilityWindow } from '../domain/availability';
import type { IGeoPoint } from '../domain/sky-state';

export const MY_TIMEZONE = 'Europe/Moscow';
// The city that names the time zone, a stand-in for the sky: not where the author is.
export const MY_LOCATION: IGeoPoint = { latitudeDegrees: 55.7558, longitudeDegrees: 37.6173 };
export const AWAKE_WINDOW: IAvailabilityWindow = { awakeStartHour: 10, awakeEndHour: 23 };
export const STATUS_CHECK_INTERVAL_MS = 60_000;
