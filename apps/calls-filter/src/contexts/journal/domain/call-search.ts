import { normalizeName } from '../../phone/domain/name-normalization';
import type { IJournalEntry } from './journal-entry';

const NOT_DIGITS = /\D/g;

/** A part of the number in any writing, or a part of any name the call came with. */
export function findsCall(entry: IJournalEntry, query: string): boolean {
  const name = normalizeName(query);
  if (name === '') {
    return true;
  }
  const digits = query.replace(NOT_DIGITS, '');
  const numbers = [entry.caller.number, entry.rawNumber?.replace(NOT_DIGITS, '')];
  const names = [
    entry.caller.contact?.name,
    entry.caller.networkName,
    entry.dialerName === null ? null : normalizeName(entry.dialerName),
  ];
  return (
    (digits !== '' && numbers.some(number => number?.includes(digits) === true)) ||
    names.some(known => known?.includes(name) === true)
  );
}
