import type { Brand } from '../types/base';

export type ISO = Brand<string, 'ISO 8601'>;

export type Nanoseconds = Brand<bigint, 'Nanoseconds'>;
export type Microseconds = Brand<bigint, 'Microseconds'>;
export type Milliseconds = Brand<number, 'Milliseconds'>;
export type Seconds = Brand<number, 'Seconds'>;
export type Minutes = Brand<number, 'Minutes'>;
export type Hours = Brand<number, 'Hours'>;
export type Days = Brand<number, 'Days'>;
export type Weeks = Brand<number, 'Weeks'>;
export type Timestamp = Milliseconds;
export type TimeZone = Brand<string, 'TimeZone'>;
