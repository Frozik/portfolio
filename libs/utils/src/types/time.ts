import type { Temporal } from '@js-temporal/polyfill';

import type { Opaque } from './base';

export type ISO = Opaque<'ISO 8601', string>;

export type Nanoseconds = Opaque<'Nanoseconds', bigint>;
export type Microseconds = Opaque<'Microseconds', bigint>;
export type Milliseconds = Opaque<'Milliseconds', number>;
export type Seconds = Opaque<'Seconds', number>;
export type Minutes = Opaque<'Minutes', number>;
export type Hours = Opaque<'Hours', number>;
export type Days = Opaque<'Days', number>;
export type Weeks = Opaque<'Weeks', number>;
export type Timestamp = Milliseconds;
export type TimeZone = Opaque<'TimeZone', string>;

export enum EDayOfWeek {
  Monday = 1,
  Tuesday = 2,
  Wednesday = 3,
  Thursday = 4,
  Friday = 5,
  Saturday = 6,
  Sunday = 7,
}

export type Tenor = Opaque<'Tenor', string>;
export interface TenorDate {
  tenor: Tenor;
  date: Temporal.PlainDate;
}
