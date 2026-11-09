import { Temporal } from 'temporal-polyfill';

import type { TGroupId } from '../../grouping/domain/group';
import { stranger } from '../../grouping/testing/group-book-fixtures';
import type { IJournalEntry, TJournalEntryId, TJournalOutcome } from './journal-entry';
import { mergeJournal } from './journal-merge';

function entry(
  id: string,
  number: string,
  at: string,
  outcome: IJournalEntry['outcome']
): IJournalEntry {
  return {
    id: id as TJournalEntryId,
    at: Temporal.Instant.from(at),
    rawNumber: `+${number}`,
    caller: stranger(number),
    outcome,
  };
}

const SCREENED: TJournalOutcome = {
  kind: 'screened',
  verdict: 'rejected',
  groupAtCall: 'spam' as TGroupId,
  alsoClaimedBy: [],
};

describe('the journal with the phone history', () => {
  it('keeps one entry for a call both logs have, the screened one', () => {
    const merged = mergeJournal(
      [entry('screened', '31201234567', '2026-11-08T10:00:00Z', SCREENED)],
      [
        entry('history', '31201234567', '2026-11-08T10:00:40Z', {
          kind: 'history',
          type: 'blocked',
        }),
      ]
    );
    expect(merged.map(item => item.id)).toEqual(['screened']);
  });

  it('adds the calls from before the app, newest first', () => {
    const merged = mergeJournal(
      [entry('screened', '31201234567', '2026-11-08T10:00:00Z', SCREENED)],
      [
        entry('old', '31851234567', '2026-10-01T09:00:00Z', { kind: 'history', type: 'missed' }),
        entry('other', '31201234567', '2026-11-07T10:00:00Z', {
          kind: 'history',
          type: 'incoming',
        }),
      ]
    );
    expect(merged.map(item => item.id)).toEqual(['screened', 'other', 'old']);
  });
});
