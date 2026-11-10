import { Temporal } from 'temporal-polyfill';

import { CALL_SCREENING } from '../../modules/call-screening/src/CallScreeningModule';
import type { IJournalEntry, TJournalEntryId } from '../contexts/journal/domain/journal-entry';
import type { ICallHistory } from '../contexts/journal/domain/ports/call-history';
import type { TE164Digits } from '../contexts/phone/domain/caller';
import type { TCountryCode } from '../contexts/phone/domain/dialing-region';
import { normalizeName } from '../contexts/phone/domain/name-normalization';
import type { IPhoneNumbering } from '../contexts/phone/domain/ports/phone-numbering';

/** Android's call log through the module, each row a caller the domain knows (nothing without the permission). */
export function nativeCallHistory(
  numbering: IPhoneNumbering,
  home: () => TCountryCode
): ICallHistory {
  return {
    async since(from, limit) {
      const calls = await CALL_SCREENING.systemCallLog(from.epochMilliseconds, limit);
      // A number calls many times: parse it once per read.
      const parsed = new Map<string, TE164Digits | null>();
      const numberOf = (raw: string) => {
        if (!parsed.has(raw)) {
          parsed.set(raw, numbering.parse(raw, home()));
        }
        return parsed.get(raw) ?? null;
      };
      return calls.map((call): IJournalEntry => {
        const number = call.rawNumber === null ? null : numberOf(call.rawNumber);
        return {
          id: `history:${call.epochMs}:${call.rawNumber ?? ''}` as TJournalEntryId,
          at: Temporal.Instant.fromEpochMilliseconds(call.epochMs),
          rawNumber: call.rawNumber,
          caller: {
            number,
            traits: number === null ? null : numbering.traits(number),
            networkName: null,
            contact:
              call.contactId === null || call.contactName === null
                ? null
                : {
                    lookupKey: call.contactId,
                    displayName: call.contactName,
                    name: normalizeName(call.contactName),
                  },
          },
          dialerName: call.contactId === null ? call.cachedName : null,
          answered: call.kind === 'incoming' ? true : call.kind === 'missed' ? false : null,
          outcome: { kind: 'history', type: call.kind },
        };
      });
    },
  };
}
