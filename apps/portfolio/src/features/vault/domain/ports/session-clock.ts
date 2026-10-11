import type { Temporal } from 'temporal-polyfill';

/** The session's time: epoch milliseconds on the wall clock, the local date, a repeating timer and a one-shot one. */
export interface ISessionClock {
  now(): number;
  /** The date in the user's time zone: what expiry is counted against. */
  today(): Temporal.PlainDate;
  every(ms: number, callback: () => void): () => void;
  after(ms: number, callback: () => void): () => void;
}
