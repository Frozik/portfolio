import type { Temporal } from 'temporal-polyfill';

import type { TFloatingMinute } from './floating-time';
import type { TPlaceFacts } from './place-rule';
import { NOWHERE_KNOWN, placesAllow } from './place-rule';
import type { IPolicy } from './policy';
import type { TWindowSet } from './window-set';
import { nextBoundary, windowAt } from './window-set';

/**
 * Why a group is in force or not: one without conditions always is, one with conditions while
 * all of them hold; one the user switched off never is, whatever its conditions say.
 */
export type TActivity = 'always' | 'conditions-hold' | 'conditions-unmet' | 'off';

export interface IActivityNow {
  readonly activity: TActivity;
  /** When this changes (a window starts or ends), if the clock can tell: a place it cannot. */
  readonly changesAt: TFloatingMinute | null;
}

export interface IMoment {
  readonly instant: Temporal.Instant;
  readonly local: TFloatingMinute;
}

/** A group in force takes part in finding a caller's group; one that is not is passed over. */
export function isActive(activity: TActivity): boolean {
  return activity === 'always' || activity === 'conditions-hold';
}

/**
 * Whether a group is in force right now: switched off it is not; then its conditions decide.
 * `windows` are where its schedule and calendars allow, `null` without conditions.
 */
export function activityNow(
  group: { readonly policy: IPolicy; readonly enabled: boolean },
  moment: IMoment,
  windows: TWindowSet | null,
  atPlace: TPlaceFacts = NOWHERE_KNOWN
): IActivityNow {
  if (!group.enabled) {
    return { activity: 'off', changesAt: null };
  }
  const { conditions } = group.policy;
  if (conditions === null || windows === null) {
    return { activity: 'always', changesAt: null };
  }
  if (!placesAllow(conditions.places, atPlace)) {
    return { activity: 'conditions-unmet', changesAt: null };
  }
  const changesAt = nextBoundary(windows, moment.local);
  return windowAt(windows, moment.local) === null
    ? { activity: 'conditions-unmet', changesAt }
    : { activity: 'conditions-hold', changesAt };
}
