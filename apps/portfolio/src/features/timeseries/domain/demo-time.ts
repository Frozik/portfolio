export const SECOND = 1_000_000_000n;
export const MINUTE = 60n * SECOND;
export const HOUR = 60n * MINUTE;
export const DAY = 24n * HOUR;
export const YEAR = 365n * DAY;

/** 1 January 2026, 00:00 UTC, in nanoseconds from the Unix epoch: where the year the overview shows begins. */
export const YEAR_START = 1_767_225_600n * SECOND;
