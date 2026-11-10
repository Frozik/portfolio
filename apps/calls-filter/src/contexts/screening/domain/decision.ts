import type { TGroup } from '../../grouping/domain/group';
import type { TAction } from '../../policy/domain/action';
import type { TActivity } from '../../policy/domain/activity-now';

/** What happened to a call, the journal's word for it. */
export type TVerdict = 'passed' | 'rejected' | 'awaiting-repeat' | 'passed-as-repeat' | 'paused';

export interface IDecision {
  readonly group: TGroup;
  /** Other groups in force that also took the caller: a conflict the fail-open rule settled. */
  readonly alsoClaimedBy: readonly TGroup[];
  /** Why the group decided; a group not in force — «Strangers» off — lets the call ring. */
  readonly activity: TActivity;
  readonly action: TAction;
  readonly verdict: TVerdict;
}
