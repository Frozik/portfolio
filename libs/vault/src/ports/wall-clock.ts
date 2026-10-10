import type { Temporal } from 'temporal-polyfill';

/** model.md §10.1 — the session's one corrected clock: HLC, expiry and lock deadlines all read it. */
export type TWallClock = () => Temporal.Instant;
