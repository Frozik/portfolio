import { assert } from '@frozik/utils/assert/assert';
import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Temporal } from 'temporal-polyfill';

import type { TAssignableGroup, TGroup } from '../../grouping/domain/group';
import type { GroupBook } from '../../grouping/domain/group-book';
import type { IMatchingEnvironment } from '../../grouping/domain/matching-environment';
import { membership } from '../../grouping/domain/membership';
import type { ICaller } from '../../phone/domain/caller';
import { mostLenient } from '../../policy/domain/action';
import type { IActionNow, IMoment } from '../../policy/domain/action-now';
import { actionNow } from '../../policy/domain/action-now';
import type { TPlaceFacts } from '../../policy/domain/place-rule';
import type { TRepeatPass } from '../../policy/domain/repeat-pass';
import { isRepeatPassOn } from '../../policy/domain/repeat-pass';
import type { IDecision, TVerdict } from './decision';
import { groupWindows } from './group-windows';
import type { IScreeningInputs } from './screening-inputs';

export interface IDecisionContext {
  readonly environment: IMatchingEnvironment;
  readonly inputs: IScreeningInputs;
  readonly paused: boolean;
  /** The filter-wide «a repeat rings», over every group's own. */
  readonly repeatPass: TRepeatPass;
  /** When this number was last turned away, from the journal: the evidence of a repeat. */
  readonly lastRejectedAt: Temporal.Instant | null;
  /** Whether the phone is at each place, as its geofences last said. */
  readonly atPlace: TPlaceFacts;
}

function actionOf(group: TGroup, moment: IMoment, context: IDecisionContext): IActionNow {
  return actionNow(
    group,
    moment,
    groupWindows(group.policy, context.inputs, context.environment.networkCountry),
    context.atPlace
  );
}

/** Fail-open for a conflict still open: the most lenient group, the older one on a tie. */
function settle(
  groups: readonly TAssignableGroup[],
  moment: IMoment,
  context: IDecisionContext
): TAssignableGroup {
  const lenient = mostLenient(groups.map(group => actionOf(group, moment, context).action));
  const candidates = groups.filter(group => actionOf(group, moment, context).action === lenient);
  const [oldest] = [...candidates].sort(
    (left, right) => left.createdAt.epochMilliseconds - right.createdAt.epochMilliseconds
  );
  assert(oldest !== undefined, 'a conflict has groups');
  return oldest;
}

function blockedVerdict(group: TGroup, moment: IMoment, context: IDecisionContext): TVerdict {
  const repeatRings =
    isRepeatPassOn(group.policy.repeatPass, moment.instant) ||
    isRepeatPassOn(context.repeatPass, moment.instant);
  if (!repeatRings) {
    return 'rejected';
  }
  const last = context.lastRejectedAt;
  const isRepeat =
    last !== null &&
    moment.instant.since(last).total('minutes') <= group.policy.repeatWindowMinutes;
  return isRepeat ? 'passed-as-repeat' : 'awaiting-repeat';
}

function verdictOf(
  action: IActionNow,
  group: TGroup,
  moment: IMoment,
  context: IDecisionContext
): TVerdict {
  switch (action.action) {
    case 'pass':
      return 'passed';
    case 'block':
      return blockedVerdict(group, moment, context);
    default:
      return assertNever(action.action);
  }
}

/** The answer to a call, exactly as the screening service gives it from the published ruleset. */
export function decide(
  book: GroupBook,
  caller: ICaller,
  moment: IMoment,
  context: IDecisionContext
): IDecision {
  const found = membership(book, caller, context.environment);
  const group = found.kind === 'one' ? found.group : settle(found.groups, moment, context);
  const alsoClaimedBy =
    found.kind === 'one' ? [] : found.groups.filter(other => other.id !== group.id);
  const action = actionOf(group, moment, context);
  const verdict: TVerdict = context.paused ? 'paused' : verdictOf(action, group, moment, context);
  return { group, alsoClaimedBy, action, verdict };
}
