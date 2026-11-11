import type { IDiagnosticsEntry } from '../diagnostics/domain/diagnostics-entry';
import type { TDiagnosticsTerm } from '../diagnostics/domain/diagnostics-terms';
import { DEFAULT_DIAGNOSTICS_TERM } from '../diagnostics/domain/diagnostics-terms';
import type { IDiagnosticsJournal } from '../diagnostics/domain/ports/diagnostics-journal';

/** A device's diagnostics log in memory, oldest first as it was written. */
export function createMemoryDiagnosticsJournal(): IDiagnosticsJournal & {
  readonly entries: () => readonly IDiagnosticsEntry[];
} {
  let entries: readonly IDiagnosticsEntry[] = [];
  let term: TDiagnosticsTerm = DEFAULT_DIAGNOSTICS_TERM;
  return {
    entries: () => entries,
    append: entry => {
      entries = [...entries, entry];
      return true;
    },
    latest: limit => [...entries].reverse().slice(0, limit),
    dropBefore: at => {
      entries = entries.filter(entry => entry.at.epochMilliseconds >= at.epochMilliseconds);
      return true;
    },
    term: () => term,
    setTerm: next => {
      term = next;
      return true;
    },
  };
}
