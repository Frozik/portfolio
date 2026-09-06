/** Number of milliseconds in one second. */
export const MS_PER_SECOND = 1000;
export const SECONDS_PER_MINUTE = 60;
export const MINUTES_PER_HOUR = 60;
export const HOURS_PER_DAY = 24;
export const MINUTES_PER_DAY = MINUTES_PER_HOUR * HOURS_PER_DAY;
export const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * MINUTES_PER_HOUR;
export const SECONDS_PER_DAY = SECONDS_PER_HOUR * HOURS_PER_DAY;
export const MS_PER_MINUTE = MS_PER_SECOND * SECONDS_PER_MINUTE;
export const MS_PER_HOUR = MS_PER_MINUTE * MINUTES_PER_HOUR;
export const MS_PER_DAY = MS_PER_HOUR * HOURS_PER_DAY;

/** Number of days in one week. */
export const DAYS_IN_WEEK = 7;

export enum EDayOfWeek {
  Monday = 1,
  Tuesday = 2,
  Wednesday = 3,
  Thursday = 4,
  Friday = 5,
  Saturday = 6,
  Sunday = 7,
}

export enum EDateTimeStep {
  Minute = 'minute',
  Hour = 'hour',
  Day = 'day',
  Week = 'week',
}

export enum ETimeResolution {
  Minutes = 'minutes',
  Seconds = 'seconds',
  Milliseconds = 'milliseconds',
}

export enum EDayType {
  Business = 'business',
  Holiday = 'holiday',
  Weekend = 'weekend',
}
