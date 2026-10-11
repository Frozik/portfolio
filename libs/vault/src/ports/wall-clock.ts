import type { Temporal } from 'temporal-polyfill';

/** The session's one corrected clock: HLC, expiry and lock deadlines all read it. */
export type TWallClock = () => Temporal.Instant;
