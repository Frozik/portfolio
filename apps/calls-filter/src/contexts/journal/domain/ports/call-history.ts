import type { Temporal } from 'temporal-polyfill';

import type { IJournalEntry } from '../journal-entry';

/** The phone's own call log: the calls from before the app, and those it did not screen. */
export interface ICallHistory {
  since(from: Temporal.Instant, limit: number): Promise<readonly IJournalEntry[]>;
}
