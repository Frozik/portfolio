import type { Temporal } from 'temporal-polyfill';

import type { IDiagnosticsEntry } from '../diagnostics-entry';
import type { TDiagnosticsTerm } from '../diagnostics-terms';

/**
 * This device's diagnostics log, and how long it keeps it. It never throws at the app: a log that
 * cannot be read or written (a full disk, a broken file) is empty, and a write says it did not happen.
 */
export interface IDiagnosticsJournal {
  append(entry: IDiagnosticsEntry): boolean;
  /** Newest first. */
  latest(limit: number): readonly IDiagnosticsEntry[];
  dropBefore(at: Temporal.Instant): boolean;
  term(): TDiagnosticsTerm;
  setTerm(term: TDiagnosticsTerm): boolean;
}
