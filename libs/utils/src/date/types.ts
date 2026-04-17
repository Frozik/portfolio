import type { Opaque } from '../types/base';

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
