/** Number of milliseconds in one second. */
export const MS_PER_SECOND = 1000;

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
