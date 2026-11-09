import type { Temporal } from 'temporal-polyfill';

import type { IJournalEntry } from '../journal-entry';

/** The service's call log, read-only to the app. */
export interface ICallJournal {
  since(from: Temporal.Instant, limit: number): Promise<readonly IJournalEntry[]>;
  /** Called whenever the service writes a call; returns the unsubscribe. */
  onChange(listener: () => void): () => void;
}
