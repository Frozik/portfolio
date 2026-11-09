import { assertNever } from '@frozik/utils/assert/assertNever';
import { Temporal } from 'temporal-polyfill';

import type { INativeCallRecord } from '../../modules/call-screening/src/CallScreening.types';
import { CALL_SCREENING } from '../../modules/call-screening/src/CallScreeningModule';
import type { TGroupId } from '../contexts/grouping/domain/group';
import type { IJournalEntry, TJournalEntryId } from '../contexts/journal/domain/journal-entry';
import type { ICallJournal } from '../contexts/journal/domain/ports/call-journal';
import type { TE164Digits } from '../contexts/phone/domain/caller';
import { normalizeName } from '../contexts/phone/domain/name-normalization';
import type { IPhoneNumbering } from '../contexts/phone/domain/ports/phone-numbering';
import type { TVerdict } from '../contexts/screening/domain/decision';

function verdictOf(verdict: INativeCallRecord['verdict']): TVerdict {
  switch (verdict) {
    case 'PASSED':
      return 'passed';
    case 'REJECTED':
      return 'rejected';
    case 'AWAITING_REPEAT':
      return 'awaiting-repeat';
    case 'PASSED_AS_REPEAT':
      return 'passed-as-repeat';
    case 'PAUSED':
      return 'paused';
    default:
      return assertNever(verdict);
  }
}

/** The service's journal through the module, its rows turned into callers the domain knows. */
export function nativeCallJournal(numbering: IPhoneNumbering): ICallJournal {
  return {
    async since(from, limit) {
      const records = await CALL_SCREENING.calls(from.epochMilliseconds, limit);
      return records.map((record): IJournalEntry => {
        const number = record.number as TE164Digits | null;
        return {
          id: `${record.epochMs}:${record.rawNumber ?? ''}` as TJournalEntryId,
          at: Temporal.Instant.fromEpochMilliseconds(record.epochMs),
          rawNumber: record.rawNumber,
          caller: {
            number,
            traits: number === null ? null : numbering.traits(number),
            networkName: record.networkName === null ? null : normalizeName(record.networkName),
            contact:
              record.contactName === null || record.contactLookupKey === null
                ? null
                : {
                    lookupKey: record.contactLookupKey,
                    displayName: record.contactName,
                    name: normalizeName(record.contactName),
                  },
          },
          dialerName: null,
          outcome: {
            kind: 'screened',
            verdict: verdictOf(record.verdict),
            groupAtCall: record.groupId as TGroupId,
            alsoClaimedBy: record.alsoClaimedBy as TGroupId[],
          },
        };
      });
    },
    onChange(listener) {
      const subscription = CALL_SCREENING.addListener('onCallScreened', listener);
      return () => subscription.remove();
    },
  };
}
