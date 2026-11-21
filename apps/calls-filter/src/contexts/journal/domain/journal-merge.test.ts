import { Temporal } from 'temporal-polyfill';

import type { TGroupId } from '../../grouping/domain/group';
import { stranger, strangerWithDialerName } from '../../grouping/testing/group-book-fixtures';
import type { ICaller } from '../../phone/domain/caller';
import type { IJournalEntry, TJournalEntryId, TJournalOutcome } from './journal-entry';
import { mergeJournal } from './journal-merge';

function entry(
  id: string,
  number: string,
  at: string,
  outcome: IJournalEntry['outcome'],
  caller: ICaller = stranger(number),
  answered: boolean | null = null
): IJournalEntry {
  return {
    id: id as TJournalEntryId,
    at: Temporal.Instant.from(at),
    rawNumber: `+${number}`,
    caller,
    answered,
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

  it('keeps the name the dialer found for a screened call, which only the phone’s history has', () => {
    const merged = mergeJournal(
      [entry('screened', '31201234567', '2026-11-08T10:00:00Z', SCREENED)],
      [
        entry(
          'history',
          '31201234567',
          '2026-11-08T10:00:40Z',
          { kind: 'history', type: 'blocked' },
          strangerWithDialerName('31201234567', 'Bakkerij de Graaf')
        ),
      ]
    );
    expect(merged.map(item => [item.id, item.caller.dialer?.displayName])).toEqual([
      ['screened', 'Bakkerij de Graaf'],
    ]);
  });

  it('names a screened call by the operator’s name the phone received after screening', () => {
    const later = entry(
      'history',
      '79864267807',
      '2026-11-21T10:00:30Z',
      { kind: 'history', type: 'incoming' },
      stranger('79864267807', 'OOO ETST: kol-tsentr')
    );
    const merged = mergeJournal(
      [entry('screened', '79864267807', '2026-11-21T10:00:00Z', SCREENED)],
      [later]
    );
    expect(merged.map(item => [item.id, item.caller.networkName])).toEqual([
      ['screened', later.caller.networkName],
    ]);
  });

  it('tells of a screened call that rang whether it was answered, which only the phone’s history knows', () => {
    const merged = mergeJournal(
      [
        entry('screened', '31201234567', '2026-11-08T10:00:00Z', {
          ...SCREENED,
          verdict: 'passed',
        }),
      ],
      [
        entry(
          'history',
          '31201234567',
          '2026-11-08T10:00:40Z',
          { kind: 'history', type: 'missed' },
          stranger('31201234567'),
          false
        ),
      ]
    );
    expect(merged.map(item => [item.id, item.answered])).toEqual([['screened', false]]);
  });
});
