import type { TGroup } from '../../grouping/domain/group';
import type { IActionNow } from '../../policy/domain/action-now';

/** What happened to a call, the journal's word for it. */
export type TVerdict = 'passed' | 'rejected' | 'awaiting-repeat' | 'passed-as-repeat' | 'paused';

export interface IDecision {
  readonly group: TGroup;
  /** Other groups that also took the caller: a conflict the fail-open rule settled. */
  readonly alsoClaimedBy: readonly TGroup[];
  readonly action: IActionNow;
  readonly verdict: TVerdict;
}
