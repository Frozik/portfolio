import type { IJournalEntry } from './journal-entry';

/** The phone writes a call the service screened into its own log too, a moment later. */
const SAME_CALL_WINDOW_MS = 120_000;

/**
 * The service's journal and the phone's history as one list: a history call the service also
 * screened is the same call, and the service's entry (it knows the verdict) wins, with the name
 * the dialer found later and whether it was answered, which only the history has.
 */
export function mergeJournal(
  screened: readonly IJournalEntry[],
  history: readonly IJournalEntry[]
): readonly IJournalEntry[] {
  const sameCall = (left: IJournalEntry, right: IJournalEntry) =>
    left.caller.number === right.caller.number &&
    Math.abs(left.at.epochMilliseconds - right.at.epochMilliseconds) <= SAME_CALL_WINDOW_MS;
  const named = screened.map(known => {
    const logged = history.find(entry => sameCall(known, entry));
    return {
      ...known,
      dialerName: known.dialerName ?? logged?.dialerName ?? null,
      answered: known.answered ?? logged?.answered ?? null,
    };
  });
  const onlyInHistory = history.filter(entry => !screened.some(known => sameCall(known, entry)));
  return [...named, ...onlyInHistory].sort(
    (left, right) => right.at.epochMilliseconds - left.at.epochMilliseconds
  );
}
