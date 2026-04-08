import type { Temporal } from '@js-temporal/polyfill';

import type { Tenor } from '../types';

/** Configurable step unit for pip-size increment/decrement */
export enum EDateTimeStep {
  Minute = 'minute',
  Hour = 'hour',
  Day = 'day',
  Week = 'week',
}

/** Time precision level for the time picker */
export enum ETimeResolution {
  Minutes = 'minutes',
  Seconds = 'seconds',
  Milliseconds = 'milliseconds',
}

/** Day classification for calendar rendering */
export enum EDayType {
  Business = 'business',
  Holiday = 'holiday',
  Weekend = 'weekend',
}

/** Day metadata returned by the classification callback */
export interface DayInfo {
  readonly type: EDayType;
  readonly tenor?: Tenor;
}

/** Temporal classification of a parsed date expression */
export enum EParseTemporality {
  PastDirected = 'PastDirected',
  ExplicitDate = 'ExplicitDate',
  FutureDirected = 'FutureDirected',
  TimeOnly = 'TimeOnly',
  Weekday = 'Weekday',
  DayOfMonth = 'DayOfMonth',
  MonthDay = 'MonthDay',
  MonthOnly = 'MonthOnly',
  Quarter = 'Quarter',
  Boundary = 'Boundary',
  KeywordTime = 'KeywordTime',
}

/** Result of parsing user input text */
export type DateTimeParseResult =
  | { readonly success: true; readonly value: Temporal.ZonedDateTime }
  | { readonly success: false; readonly reason: string };
