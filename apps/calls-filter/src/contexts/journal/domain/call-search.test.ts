import { Temporal } from 'temporal-polyfill';

import { contact, stranger } from '../../grouping/testing/group-book-fixtures';
import type { ICaller } from '../../phone/domain/caller';
import { findsCall } from './call-search';
import type { IJournalEntry, TJournalEntryId } from './journal-entry';

function call(caller: ICaller, rawNumber: string | null, dialerName: string | null = null) {
  const entry: IJournalEntry = {
    id: 'call' as TJournalEntryId,
    at: Temporal.Instant.from('2026-11-10T10:00:00Z'),
    rawNumber,
    caller,
    dialerName,
    answered: null,
    outcome: { kind: 'history', type: 'missed' },
  };
  return entry;
}

const OPERATOR_NAMED = call(stranger('79864563560', 'IP Isanshin: kol-tsentr'), '+79864563560');
const LOCAL_NUMBER = call(stranger('31612345678'), '0612345678');

describe('finding a call by part of its number or a name', () => {
  it('finds every call while nothing is typed', () => {
    expect(findsCall(LOCAL_NUMBER, '  ')).toBe(true);
  });

  it('finds a number by its digits, however the query is written', () => {
    expect(
      ['456-35', '+7 986', '(986) 456'].map(query => findsCall(OPERATOR_NAMED, query))
    ).toEqual([true, true, true]);
  });

  it('finds a number by its digits as the phone received it, the leading zero included', () => {
    expect(findsCall(LOCAL_NUMBER, '0612')).toBe(true);
  });

  it('passes a number without the typed digits', () => {
    expect(findsCall(LOCAL_NUMBER, '777')).toBe(false);
  });

  it('finds the name the operator sent, whatever its case', () => {
    expect(findsCall(OPERATOR_NAMED, 'isanSHIN')).toBe(true);
  });

  it('finds the contact’s name and the name the dialer found', () => {
    expect([
      findsCall(call(contact('Анна Петрова', '31611111111'), null), 'петров'),
      findsCall(call(stranger('31622222222'), null, 'Pizza Napoli'), 'napoli'),
    ]).toEqual([true, true]);
  });

  it('passes a hidden number for digits, and a call whose names lack the words', () => {
    expect([
      findsCall(call({ ...stranger('0'), number: null }, null), '12'),
      findsCall(OPERATOR_NAMED, 'pizza'),
    ]).toEqual([false, false]);
  });
});
