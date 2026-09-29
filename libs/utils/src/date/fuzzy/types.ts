import type { Temporal } from 'temporal-polyfill';

/** When and where the question is asked: the moment, and the zone whose calendar and clock apply. */
export interface IParseContext {
  readonly now: Temporal.Instant;
  readonly timeZone: string;
}

export type DateTimeParseResult =
  | { readonly success: true; readonly value: Temporal.ZonedDateTime }
  | { readonly success: false; readonly reason: string };
