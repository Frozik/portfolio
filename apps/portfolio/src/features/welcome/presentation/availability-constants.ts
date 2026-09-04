import type { IAvailabilityWindow } from '../domain/availability';

export const MY_TIMEZONE = 'Europe/Moscow';
export const AWAKE_WINDOW: IAvailabilityWindow = { awakeStartHour: 10, awakeEndHour: 23 };
export const STATUS_CHECK_INTERVAL_MS = 60_000;
