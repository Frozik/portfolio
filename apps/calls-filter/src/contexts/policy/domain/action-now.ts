import { assertNever } from '@frozik/utils/assert/assertNever';
import type { Temporal } from 'temporal-polyfill';

import type { TAction } from './action';
import { oppositeOf } from './action';
import type { TFloatingMinute } from './floating-time';
import type { TPlaceFacts } from './place-rule';
import { NOWHERE_KNOWN, placesAllow } from './place-rule';
import type { IPolicy, ITemporaryPolicy, TTemporaryUntil } from './policy';
import { windowActionOf } from './window-action';
import type { TWindowSet } from './window-set';
import { nextBoundary, windowAt } from './window-set';

type TActionSource = 'temporary' | 'scheduled' | 'otherwise';

export interface IActionNow {
  readonly action: TAction;
  readonly source: TActionSource;
  /** When this action stops applying (the temporary policy ends or a window starts or ends), if known. */
  readonly changesAt:
    | { readonly kind: 'instant'; readonly at: Temporal.Instant }
    | { readonly kind: 'local'; readonly at: TFloatingMinute }
    | null;
}

export interface IMoment {
  readonly instant: Temporal.Instant;
  readonly local: TFloatingMinute;
}

function temporaryEnd(until: TTemporaryUntil): Temporal.Instant {
  switch (until.kind) {
    case 'instant':
    case 'end-of-event':
      return until.at;
    case 'first-pass':
      return until.latest;
    default:
      return assertNever(until);
  }
}

export function isTemporaryActive(
  temporary: ITemporaryPolicy | null,
  instant: Temporal.Instant
): temporary is ITemporaryPolicy {
  return (
    temporary !== null &&
    temporaryEnd(temporary.until).epochMilliseconds > instant.epochMilliseconds
  );
}

/**
 * What a group does with a call right now: a temporary policy wins while it lasts; then the
 * scheduled action inside its windows; otherwise the default. `windows` are the scheduled
 * action's windows, `null` when the policy has none.
 */
export function actionNow(
  group: { readonly policy: IPolicy; readonly temporary: ITemporaryPolicy | null },
  moment: IMoment,
  windows: TWindowSet | null,
  atPlace: TPlaceFacts = NOWHERE_KNOWN
): IActionNow {
  if (isTemporaryActive(group.temporary, moment.instant)) {
    return {
      action: group.temporary.action,
      source: 'temporary',
      changesAt: { kind: 'instant', at: temporaryEnd(group.temporary.until) },
    };
  }
  const { scheduled } = group.policy;
  if (scheduled === null || windows === null) {
    return { action: group.policy.otherwise, source: 'otherwise', changesAt: null };
  }
  const boundary = nextBoundary(windows, moment.local);
  const changesAt = boundary === null ? null : { kind: 'local' as const, at: boundary };
  return windowAt(windows, moment.local) === null || !placesAllow(scheduled.places, atPlace)
    ? { action: group.policy.otherwise, source: 'otherwise', changesAt }
    : { action: windowActionOf(group.policy), source: 'scheduled', changesAt };
}

/**
 * What a change for a while does: the opposite of what the group does now; while one still
 * runs, its own action, so a new term only extends it.
 */
export function temporaryActionOf(now: IActionNow): TAction {
  return now.source === 'temporary' ? now.action : oppositeOf(now.action);
}
