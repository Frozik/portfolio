import type { Temporal } from 'temporal-polyfill';

/** The moment of now: domain code takes it as an argument, application code asks this. */
export interface IClock {
  now(): Temporal.Instant;
  /** The wall clock where the phone is. */
  localNow(): Temporal.PlainDateTime;
  /** The zone the phone is in now: it turns the journal's instants into the days it shows. */
  timeZone(): string;
}
