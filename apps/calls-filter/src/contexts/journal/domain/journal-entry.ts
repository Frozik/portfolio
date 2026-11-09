import type { Brand } from '@frozik/utils/types/base';
import type { Temporal } from 'temporal-polyfill';

import type { TGroupId } from '../../grouping/domain/group';
import type { ICaller } from '../../phone/domain/caller';
import type { TVerdict } from '../../screening/domain/decision';

export type TJournalEntryId = Brand<string, 'JournalEntryId'>;

type THistoryType = 'incoming' | 'missed' | 'rejected' | 'blocked';

/**
 * What happened to the call: screened by the service (its verdict, and the group it went to
 * then), or a call of the phone's own history the service never saw.
 */
export type TJournalOutcome =
  | {
      readonly kind: 'screened';
      readonly verdict: TVerdict;
      readonly groupAtCall: TGroupId;
      readonly alsoClaimedBy: readonly TGroupId[];
    }
  | { readonly kind: 'history'; readonly type: THistoryType };

/** One incoming call: number and names as they came. The group it belongs to now is derived. */
export interface IJournalEntry {
  readonly id: TJournalEntryId;
  readonly at: Temporal.Instant;
  readonly rawNumber: string | null;
  readonly caller: ICaller;
  readonly outcome: TJournalOutcome;
}
